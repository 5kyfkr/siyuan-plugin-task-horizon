    function __tmOpenColorPickerDialog(titleText, initialColor, onApply, options = {}) {
        __tmRemoveElementsById('tm-color-picker-backdrop');
        const swatches = Array.isArray(options?.swatches) && options.swatches.length > 0 ? options.swatches : [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
            '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
            '#795548', '#9E9E9E', '#607D8B', '#000000', '#FFFFFF'
        ];
        const paletteGroups = Array.isArray(options?.paletteGroups)
            ? options.paletteGroups.map((group, groupIndex) => {
                const colors = (Array.isArray(group?.colors) ? group.colors : [])
                    .map((color) => __tmNormalizeHexColor(color, ''))
                    .filter(Boolean);
                if (!colors.length) return null;
                return {
                    id: String(group?.id || `palette-group-${groupIndex + 1}`).trim() || `palette-group-${groupIndex + 1}`,
                    label: String(group?.label || `色系 ${groupIndex + 1}`).trim() || `色系 ${groupIndex + 1}`,
                    colors,
                };
            }).filter(Boolean)
            : [];

        const defaultColor = __tmNormalizeHexColor(options?.defaultColor, '#f44336') || '#f44336';
        let current = __tmNormalizeHexColor(initialColor, defaultColor) || defaultColor;
        const isMobilePicker = (() => {
            try {
                if (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient()) return true;
            } catch (e) {}
            try {
                if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) return true;
            } catch (e) {}
            return false;
        })();
        const swatchSize = isMobilePicker ? 32 : 32;
        const swatchGap = isMobilePicker ? 8 : 10;
        const maxPaletteColumns = isMobilePicker
            ? 8
            : (paletteGroups.length
                ? Math.max(1, ...paletteGroups.map((group) => Array.isArray(group?.colors) ? group.colors.length : 0))
                : 10);

        const backdrop = document.createElement('div');
        backdrop.id = 'tm-color-picker-backdrop';
        backdrop.className = 'tm-color-picker-backdrop';
        if (isMobilePicker) backdrop.classList.add('tm-color-picker-backdrop--mobile');

        const dialog = document.createElement('div');
        dialog.className = 'tm-color-picker-dialog';
        if (isMobilePicker) dialog.classList.add('tm-color-picker-dialog--mobile');
        const dialogHorizontalPadding = isMobilePicker ? 32 : 28;
        const gridWidth = maxPaletteColumns * swatchSize + Math.max(0, maxPaletteColumns - 1) * swatchGap;
        const compactWidth = paletteGroups.length
            ? Math.max(isMobilePicker ? 320 : 360, gridWidth + dialogHorizontalPadding)
            : Math.max(isMobilePicker ? 320 : 420, gridWidth + dialogHorizontalPadding);
        dialog.style.width = isMobilePicker ? '100vw' : `${compactWidth}px`;
        dialog.style.maxWidth = isMobilePicker ? '100vw' : 'calc(100vw - 24px)';
        dialog.style.minWidth = '0';
        dialog.style.maxHeight = 'calc(100vh - 24px)';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.textContent = String(titleText || '选择颜色');
        title.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:12px;color:var(--tm-text-color);';
        dialog.appendChild(title);

        const preview = document.createElement('div');
        preview.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;';
        if (isMobilePicker) preview.classList.add('tm-color-picker-preview--mobile');
        const previewBox = document.createElement('div');
        previewBox.style.cssText = `width:44px;height:28px;border-radius:8px;border:1px solid var(--tm-border-color);background:${current};flex:0 0 auto;`;
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = __tmFormatColorDisplayValue(current);
        hexInput.placeholder = '#RRGGBB / rgba() / hsl() / var(--token)';
        hexInput.style.cssText = 'flex:1;min-width:0;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;';
        preview.appendChild(previewBox);
        preview.appendChild(hexInput);
        dialog.appendChild(preview);
        const formatHint = document.createElement('div');
        formatHint.textContent = String(options?.formatHint || '支持 HEX、RGBA、HSL/HSLA、transparent、var(--token) 等格式');
        formatHint.style.cssText = 'margin:-2px 0 12px;font-size:12px;line-height:1.6;color:var(--tm-secondary-text);white-space:normal;word-break:break-word;overflow-wrap:anywhere;';
        dialog.appendChild(formatHint);

        const pickColorInput = document.createElement('input');
        pickColorInput.type = 'color';
        pickColorInput.value = __tmNormalizeLiteralHexColor(current) || __tmNormalizeLiteralHexColor(defaultColor) || '#f44336';
        pickColorInput.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;border:none;padding:0;pointer-events:none;';
        const swatchButtons = [];
        const syncColorPreview = () => {
            hexInput.value = __tmFormatColorDisplayValue(current);
            hexInput.style.borderColor = 'var(--tm-input-border)';
            previewBox.style.background = current;
            const literal = __tmNormalizeLiteralHexColor(current);
            if (literal) pickColorInput.value = literal;
            const normalizedCurrent = __tmNormalizeHexColor(current, '');
            swatchButtons.forEach((entry) => {
                const active = entry.color === normalizedCurrent;
                entry.el.style.boxShadow = active
                    ? '0 0 0 2px var(--tm-bg-color), 0 0 0 4px var(--tm-primary-color)'
                    : 'none';
                entry.el.style.transform = active ? 'translateY(-1px)' : 'none';
            });
        };
        const applyColorValue = (value) => {
            const norm = __tmNormalizeHexColor(value, '');
            if (!norm) return false;
            current = norm;
            syncColorPreview();
            return true;
        };
        hexInput.oninput = () => {
            if (applyColorValue(hexInput.value)) return;
            hexInput.style.borderColor = 'var(--tm-danger-color)';
        };
        pickColorInput.oninput = () => {
            applyColorValue(pickColorInput.value);
        };
        const openNativeColorPicker = () => {
            try {
                if (typeof pickColorInput.showPicker === 'function') pickColorInput.showPicker();
                else pickColorInput.click();
            } catch (e) {
                try { pickColorInput.click(); } catch (e2) {}
            }
        };
        const createSwatchButton = (norm, extraTitle = '') => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `width:100%;aspect-ratio:1 / 1;border-radius:999px;border:1px solid var(--tm-border-color);padding:0;background:${norm};cursor:pointer;transition:transform .15s ease, box-shadow .15s ease;min-width:${swatchSize}px;min-height:${swatchSize}px;`;
            btn.style.background = norm;
            btn.title = extraTitle ? `${extraTitle} ${__tmFormatColorDisplayValue(norm)}` : __tmFormatColorDisplayValue(norm);
            btn.onclick = () => {
                applyColorValue(norm);
            };
            swatchButtons.push({ el: btn, color: norm });
            return btn;
        };
        const createPickerButton = (labelText = 'pick') => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `position:relative;width:100%;aspect-ratio:1 / 1;border-radius:999px;border:1px solid var(--tm-border-color);padding:0;background:conic-gradient(from 180deg,#ff4d4f,#ffa940,#fadb14,#73d13d,#36cfc9,#40a9ff,#9254de,#ff4d4f);overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:${swatchSize}px;min-height:${swatchSize}px;`;
            btn.title = '选择自定义颜色';
            btn.onclick = (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openNativeColorPicker();
            };
            const inner = document.createElement('span');
            inner.textContent = String(labelText || 'pick');
            inner.style.cssText = 'padding:2px 5px;border-radius:999px;background:rgba(255,255,255,0.92);color:#111827;font-size:10px;font-weight:700;line-height:1;text-transform:uppercase;pointer-events:none;box-shadow:0 1px 2px rgba(0,0,0,0.12);';
            btn.appendChild(inner);
            btn.appendChild(pickColorInput);
            return btn;
        };
        const paletteWrap = document.createElement('div');
        paletteWrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
        if (paletteGroups.length) {
            paletteGroups.forEach((group) => {
                const section = document.createElement('div');
                section.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
                const label = document.createElement('div');
                label.textContent = group.label;
                label.style.cssText = 'font-size:12px;font-weight:700;color:var(--tm-text-color);';
                const grid = document.createElement('div');
                const columns = isMobilePicker ? Math.min(Math.max(1, group.colors.length), 8) : Math.max(1, group.colors.length);
                grid.style.cssText = `display:grid;grid-template-columns:repeat(${columns}, ${swatchSize}px);gap:${swatchGap}px;width:max-content;max-width:100%;`;
                group.colors.forEach((color) => {
                    grid.appendChild(createSwatchButton(color, group.label));
                });
                section.appendChild(label);
                section.appendChild(grid);
                paletteWrap.appendChild(section);
            });
            if (!isMobilePicker) {
                const customSection = document.createElement('div');
                customSection.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
                const customLabel = document.createElement('div');
                customLabel.textContent = String(options?.customSectionLabel || '自定义颜色');
                customLabel.style.cssText = 'font-size:12px;font-weight:700;color:var(--tm-text-color);';
                const customGrid = document.createElement('div');
                customGrid.style.cssText = `display:grid;grid-template-columns:repeat(1, ${swatchSize}px);gap:${swatchGap}px;width:max-content;max-width:100%;`;
                customGrid.appendChild(createPickerButton(String(options?.pickLabel || '+')));
                customSection.appendChild(customLabel);
                customSection.appendChild(customGrid);
                paletteWrap.appendChild(customSection);
            }
        } else {
            const grid = document.createElement('div');
            grid.className = 'tm-color-grid-10';
            swatches.forEach((c, index) => {
                const norm = __tmNormalizeHexColor(c, '');
                if (!norm) return;
                if (index === swatches.length - 1) {
                    grid.appendChild(createPickerButton('pick'));
                    return;
                }
                grid.appendChild(createSwatchButton(norm));
            });
            paletteWrap.appendChild(grid);
        }
        dialog.appendChild(paletteWrap);
        syncColorPreview();

        const actions = document.createElement('div');
        actions.className = 'tm-color-actions';
        if (isMobilePicker) actions.classList.add('tm-color-picker-actions--mobile');
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'tm-btn tm-btn-gray';
        cancelBtn.textContent = '取消';
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'tm-btn tm-btn-primary';
        okBtn.textContent = '应用';

        let __colorPickerUnstack = null;
        const close = () => {
            __colorPickerUnstack?.();
            __colorPickerUnstack = null;
            try { backdrop.remove(); } catch (e) {}
        };

        cancelBtn.onclick = close;
        okBtn.onclick = () => {
            const norm = __tmNormalizeHexColor(current, '');
            if (!norm) return;
            try { onApply?.(norm); } catch (e) {}
            close();
        };
        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        dialog.appendChild(actions);

        backdrop.onclick = (e) => {
            if (e.target === backdrop) close();
        };

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        __colorPickerUnstack = __tmModalStackBind(close);
    }

    function __tmBuildDocColorSchemePreviewItems(groupId, limit = 6) {
        const max = Math.max(3, Number(limit) || 6);
        const items = [];
        const seen = new Set();
        const push = (id0, label0) => {
            const id = String(id0 || '').trim();
            const label = String(label0 || '').trim() || id;
            if (!id || seen.has(id)) return;
            seen.add(id);
            items.push({ id, label });
        };
        try {
            const visible = __tmGetVisibleDocTabsForCurrentGroup();
            visible.forEach((item) => push(item?.id, item?.label || item?.name));
        } catch (e) {}
        if (items.length < max) {
            const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
            const targetGroup = groups.find((group) => String(group?.id || '').trim() === String(groupId || '').trim());
            const docs = Array.isArray(targetGroup?.docs) ? targetGroup.docs : [];
            docs.forEach((doc) => {
                const id = String((typeof doc === 'object' ? doc?.id : doc) || '').trim();
                const name = __tmGetDocDisplayName(id, __tmGetDocRawName(id, '未命名文档'));
                push(id, name);
            });
        }
        if (items.length < max) {
            const tree = Array.isArray(state?.taskTree) ? state.taskTree : [];
            tree.forEach((doc) => push(doc?.id, __tmGetDocDisplayName(doc, doc?.name || '未命名文档')));
        }
        const fallbackLabels = ['项目总览', '产品规划', '会议纪要', '日常任务', '灵感收集', '学习笔记'];
        while (items.length < max) {
            const index = items.length;
            push(`preview-doc-${index + 1}`, fallbackLabels[index] || `文档 ${index + 1}`);
        }
        return items.slice(0, max);
    }

    function __tmRefreshDocColorPresentation() {
        try { __tmDocColorHexCache.clear(); } catch (e) {}
        try { render(); } catch (e) {}
        try { if (state.settingsModal && document.body.contains(state.settingsModal)) showSettings(); } catch (e) {}
    }

    async function __tmPersistDocColorSchemeConfig(scope, nextConfig) {
        const kind = String(scope || 'default').trim();
        if (kind === 'group') {
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            if (currentGroupId === 'all') {
                hint('⚠ 请先切换到具体文档分组后再配置分组色系', 'warning');
                return false;
            }
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            const idx = groups.findIndex((group) => String(group?.id || '').trim() === currentGroupId);
            if (idx < 0) {
                hint('⚠ 当前分组不存在', 'warning');
                return false;
            }
            groups[idx] = {
                ...groups[idx],
                docColorConfig: __tmNormalizeDocColorSchemeConfig(nextConfig, {
                    allowInherit: true,
                    seedFallback: Number(SettingsStore.data.docDefaultColorScheme?.seed) || Number(SettingsStore.data.docColorSeed) || 1
                })
            };
            SettingsStore.data.docGroups = groups.map((group) => __tmNormalizeDocGroupConfig(group, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
            await SettingsStore.save();
            return true;
        }
        const normalized = __tmNormalizeDocColorSchemeConfig(nextConfig, {
            seedFallback: Number(SettingsStore.data.docColorSeed) || 1
        });
        SettingsStore.data.docDefaultColorScheme = normalized;
        SettingsStore.data.docColorSeed = Number(normalized.seed) || 1;
        await SettingsStore.save();
        return true;
    }

    function __tmOpenDocColorSchemeConfigDialog(scope = 'default') {
        const kind = String(scope || 'default').trim() === 'group' ? 'group' : 'default';
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const currentGroup = __tmGetCurrentDocGroupForColorScheme(currentGroupId);
        if (kind === 'group' && !currentGroup) {
            hint('⚠ 请先切换到具体文档分组后再配置分组色系', 'warning');
            return;
        }
        const globalConfig = __tmGetGlobalDocColorSchemeConfig();
        const initial = kind === 'group'
            ? __tmNormalizeDocColorSchemeConfig(currentGroup?.docColorConfig, { allowInherit: true, seedFallback: globalConfig.seed })
            : globalConfig;
        const draft = { ...initial };
        const previewItems = __tmBuildDocColorSchemePreviewItems(kind === 'group' ? currentGroupId : '', 6);
        const isDark = __tmIsDarkMode();

        const existing = document.querySelector('.tm-prompt-modal.tm-doc-color-scheme-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'tm-prompt-modal tm-doc-color-scheme-modal';

        const box = document.createElement('div');
        box.className = 'tm-prompt-box';
        box.style.cssText = 'width:min(92vw,640px);';

        const titleEl = document.createElement('div');
        titleEl.className = 'tm-prompt-title';
        titleEl.textContent = kind === 'group'
            ? `当前分组色系：${__tmResolveDocGroupName(currentGroup)}`
            : '所有文档默认色系';
        box.appendChild(titleEl);

        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:12px;color:var(--tm-secondary-text);line-height:1.7;margin-bottom:12px;';
        descEl.textContent = kind === 'group'
            ? '当前分组可以继承所有文档默认色系，也可以单独指定一套自动配色。手动设置过颜色的文档不会被覆盖。'
            : '控制所有未手动自定义颜色的文档自动配色。手动设置过颜色的文档仍然保持优先。';
        box.appendChild(descEl);

        const fieldWrap = document.createElement('div');
        fieldWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const inheritRow = document.createElement('label');
        inheritRow.style.cssText = 'display:none;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);';
        inheritRow.innerHTML = `
            <span>
                <div style="font-weight:600;color:var(--tm-text-color);">继承所有文档默认色系</div>
                <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;">开启后当前分组直接沿用全局设置，不单独维护自己的色系。</div>
            </span>
        `;
        const inheritInput = document.createElement('input');
        inheritInput.type = 'checkbox';
        inheritInput.className = 'b3-switch fn__flex-center';
        inheritInput.checked = draft.inherit !== false;
        inheritRow.appendChild(inheritInput);
        if (kind === 'group') inheritRow.style.display = 'flex';
        fieldWrap.appendChild(inheritRow);

        const paletteWrap = document.createElement('label');
        paletteWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);';
        const paletteTitle = document.createElement('div');
        paletteTitle.style.cssText = 'font-weight:600;color:var(--tm-text-color);';
        paletteTitle.textContent = '色系类型';
        const paletteSelect = document.createElement('select');
        paletteSelect.className = 'tm-prompt-input tm-prompt-select';
        paletteSelect.style.cssText = 'margin-top:2px;';
        paletteSelect.innerHTML = __TM_DOC_COLOR_SCHEME_PRESETS.map((item) => `
            <option value="${esc(item.id)}" ${draft.palette === item.id ? 'selected' : ''}>${esc(item.label)}</option>
        `).join('');
        const paletteDesc = document.createElement('div');
        paletteDesc.style.cssText = 'font-size:12px;color:var(--tm-secondary-text);line-height:1.6;';
        paletteWrap.appendChild(paletteTitle);
        paletteWrap.appendChild(paletteSelect);
        paletteWrap.appendChild(paletteDesc);
        fieldWrap.appendChild(paletteWrap);

        const baseColorWrap = document.createElement('div');
        baseColorWrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);';
        baseColorWrap.innerHTML = `
            <span>
                <div style="font-weight:600;color:var(--tm-text-color);">主色调</div>
                <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;">仅在“自定义主色调”下生效，围绕主色自动扩展一组文档色。</div>
            </span>
        `;
        const baseColorControls = document.createElement('div');
        baseColorControls.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const baseColorPreview = document.createElement('span');
        baseColorPreview.style.cssText = `width:28px;height:28px;border-radius:8px;border:1px solid var(--tm-border-color);background:${draft.baseColor};display:inline-flex;`;
        const baseColorInput = document.createElement('input');
        baseColorInput.type = 'color';
        baseColorInput.value = __tmNormalizeLiteralHexColor(draft.baseColor) || '#3b82f6';
        baseColorInput.style.cssText = 'width:42px;height:32px;padding:0;border:none;background:transparent;cursor:pointer;';
        const baseColorValue = document.createElement('span');
        baseColorValue.style.cssText = 'min-width:84px;font-family:monospace;font-size:12px;color:var(--tm-secondary-text);text-align:right;';
        baseColorControls.appendChild(baseColorPreview);
        baseColorControls.appendChild(baseColorInput);
        baseColorControls.appendChild(baseColorValue);
        baseColorWrap.appendChild(baseColorControls);
        fieldWrap.appendChild(baseColorWrap);

        const previewWrap = document.createElement('div');
        previewWrap.style.cssText = 'padding:10px 12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);';
        previewWrap.innerHTML = '<div style="font-weight:600;color:var(--tm-text-color);margin-bottom:8px;">预览</div><div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:8px;line-height:1.6;">以下仅预览自动配色效果，已手动指定颜色的文档不会被这里覆盖。</div>';
        const previewGrid = document.createElement('div');
        previewGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;';
        previewWrap.appendChild(previewGrid);
        fieldWrap.appendChild(previewWrap);

        box.appendChild(fieldWrap);

        const buttons = document.createElement('div');
        buttons.className = 'tm-prompt-buttons';
        buttons.style.cssText = 'justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;';
        const leftActions = document.createElement('div');
        leftActions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
        const reshuffleBtn = document.createElement('button');
        reshuffleBtn.className = 'tm-prompt-btn tm-prompt-btn-secondary';
        reshuffleBtn.textContent = kind === 'group' ? '重排当前分组自动颜色' : '重排全局自动颜色';
        leftActions.appendChild(reshuffleBtn);
        buttons.appendChild(leftActions);
        const rightActions = document.createElement('div');
        rightActions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tm-prompt-btn tm-prompt-btn-secondary';
        cancelBtn.textContent = '取消';
        const okBtn = document.createElement('button');
        okBtn.className = 'tm-prompt-btn tm-prompt-btn-primary';
        okBtn.textContent = '应用';
        rightActions.appendChild(cancelBtn);
        rightActions.appendChild(okBtn);
        buttons.appendChild(rightActions);
        box.appendChild(buttons);
        modal.appendChild(box);
        document.body.appendChild(modal);
        __tmApplyPopupOpenAnimation(modal, box);

        const removeFromStack = __tmModalStackBind(() => cancelBtn.click());
        const close = () => {
            removeFromStack();
            try { modal.remove(); } catch (e) {}
        };

        const renderPreview = () => {
            const preset = __tmGetDocColorSchemePreset(draft.palette);
            paletteDesc.textContent = preset.description || '';
            const disabledByInherit = kind === 'group' && draft.inherit !== false;
            paletteSelect.disabled = disabledByInherit;
            reshuffleBtn.disabled = disabledByInherit;
            reshuffleBtn.style.opacity = disabledByInherit ? '0.55' : '1';
            paletteWrap.style.opacity = disabledByInherit ? '0.6' : '1';
            baseColorWrap.style.display = draft.palette === 'custom' ? 'flex' : 'none';
            baseColorWrap.style.opacity = disabledByInherit ? '0.6' : '1';
            baseColorInput.disabled = disabledByInherit;
            baseColorPreview.style.background = draft.baseColor;
            baseColorValue.textContent = String(__tmFormatColorDisplayValue(draft.baseColor) || '').trim() || '#3B82F6';
            previewGrid.innerHTML = '';
            const previewConfig = kind === 'group' && draft.inherit !== false
                ? globalConfig
                : __tmNormalizeDocColorSchemeConfig(draft, {
                    allowInherit: kind === 'group',
                    seedFallback: globalConfig.seed
                });
            previewItems.forEach((item) => {
                const color = __tmBuildAutoDocColorFromScheme(item.id, isDark, previewConfig);
                const chip = document.createElement('div');
                chip.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-input-bg);min-width:0;';
                chip.innerHTML = `
                    <span style="width:14px;height:14px;border-radius:999px;background:${esc(color)};display:inline-flex;flex:0 0 auto;border:1px solid color-mix(in srgb, ${esc(color)} 48%, var(--tm-border-color));"></span>
                    <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${esc(color)};font-weight:600;">${esc(String(item.label || '').trim() || '未命名文档')}</span>
                `;
                previewGrid.appendChild(chip);
            });
        };

        inheritInput.onchange = () => {
            draft.inherit = !!inheritInput.checked;
            renderPreview();
        };
        paletteSelect.onchange = () => {
            draft.palette = __tmNormalizeDocColorSchemePalette(paletteSelect.value);
            renderPreview();
        };
        baseColorInput.oninput = () => {
            draft.baseColor = __tmNormalizeHexColor(baseColorInput.value, draft.baseColor) || draft.baseColor;
            renderPreview();
        };
        reshuffleBtn.onclick = () => {
            if (kind === 'group' && draft.inherit !== false) return;
            draft.seed = Math.floor(Math.random() * 1000000000) + 1;
            renderPreview();
        };
        cancelBtn.onclick = close;
        okBtn.onclick = async () => {
            const persisted = await __tmPersistDocColorSchemeConfig(kind, draft);
            if (!persisted) return;
            hint(kind === 'group' ? '✅ 当前分组色系已更新' : '✅ 所有文档默认色系已更新', 'success');
            __tmRefreshDocColorPresentation();
            close();
        };
        modal.onclick = (e) => {
            if (e.target === modal) cancelBtn.click();
        };

        renderPreview();
    }
    window.tmOpenDocColorSchemeConfigDialog = __tmOpenDocColorSchemeConfigDialog;

    function __tmNormalizeAppearanceMetric(input, fallback, min, max) {
        const n = Number(input);
        if (!Number.isFinite(n)) return fallback;
        return Math.round(__tmClamp(n, min, max));
    }

    function __tmGetTopbarControlAppearance(isDark) {
        const d = SettingsStore.data || {};
        const themeDefaults = __tmBuildThemeAppearanceDefaults(d.themeConfig, isDark);
        const topbarText = isDark
            ? __tmNormalizeHexColor(d.topbarTextColorDark, themeDefaults.topbarTextColor)
            : __tmNormalizeHexColor(d.topbarTextColorLight, themeDefaults.topbarTextColor);
        const controlTextFallback = themeDefaults.topbarControlText || topbarText || (isDark ? '#FFFFFF' : '#003252');
        const controlBgFallback = themeDefaults.topbarControlBg || __tmWithAlpha('#ffffff', 0.12);
        const controlHoverFallback = themeDefaults.topbarControlHover || __tmWithAlpha('#000000', 0.12);
        const segBgFallback = themeDefaults.topbarControlSegmentBg || __tmWithAlpha('#ffffff', 0.18);
        const segActiveFallback = themeDefaults.topbarControlSegmentActiveBg || __tmWithAlpha('#000000', 0.26);
        const shadowColorFallback = themeDefaults.topbarControlShadowColor || (isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(15, 23, 42, 0.16)');
        const controlText = __tmNormalizeHexColor(
            isDark ? d.topbarControlTextDark : d.topbarControlTextLight,
            controlTextFallback
        ) || controlTextFallback;
        const controlBg = __tmNormalizeHexColor(
            isDark ? d.topbarControlBgDark : d.topbarControlBgLight,
            controlBgFallback
        ) || controlBgFallback;
        const controlBorder = __tmNormalizeHexColor(
            isDark ? d.topbarControlBorderDark : d.topbarControlBorderLight,
            __tmWithAlpha(controlText || controlTextFallback, 0.34)
        ) || __tmWithAlpha(controlText || controlTextFallback, 0.34);
        const controlHover = __tmNormalizeHexColor(
            isDark ? d.topbarControlHoverDark : d.topbarControlHoverLight,
            controlHoverFallback
        ) || controlHoverFallback;
        const segBg = __tmNormalizeHexColor(
            isDark ? d.topbarControlSegmentBgDark : d.topbarControlSegmentBgLight,
            segBgFallback
        ) || segBgFallback;
        const segActive = __tmNormalizeHexColor(
            isDark ? d.topbarControlSegmentActiveBgDark : d.topbarControlSegmentActiveBgLight,
            segActiveFallback
        ) || segActiveFallback;
        const shadowColor = __tmNormalizeHexColor(
            isDark ? d.topbarControlShadowColorDark : d.topbarControlShadowColorLight,
            shadowColorFallback
        ) || shadowColorFallback;
        const radiusPx = __tmNormalizeAppearanceMetric(d.topbarControlRadiusPx, 10, 0, 24);
        const borderWidthPx = __tmNormalizeAppearanceMetric(d.topbarControlBorderWidthPx, 1, 0, 4);
        const shadowYOffsetPx = __tmNormalizeAppearanceMetric(d.topbarControlShadowYOffsetPx, 0, 0, 24);
        const shadowBlurPx = __tmNormalizeAppearanceMetric(d.topbarControlShadowBlurPx, 0, 0, 48);
        const shadowStrengthPct = __tmNormalizeAppearanceMetric(d.topbarControlShadowStrengthPct, 100, 0, 200);
        const shadowTint = __tmScaleColorAlpha(shadowColor, shadowStrengthPct / 100);
        const shadow = (shadowYOffsetPx > 0 || shadowBlurPx > 0)
            ? `0 ${shadowYOffsetPx}px ${shadowBlurPx}px ${shadowTint}`
            : 'none';
        return {
            topbarText,
            controlText,
            controlBg,
            controlBorder,
            controlHover,
            segBg,
            segActive,
            shadowColor,
            radiusPx,
            borderWidthPx,
            shadowYOffsetPx,
            shadowBlurPx,
            shadowStrengthPct,
            shadow,
        };
    }

    function __tmApplyAppearanceThemeVars() {
        const isDark = __tmIsDarkMode();
        const root = document.documentElement;
        const themeConfig = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        const palette = __tmBuildThemePalette(themeConfig, isDark);
        const themeDefaults = __tmBuildThemeAppearanceDefaults(themeConfig, isDark);

        const start = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.topbarGradientDarkStart, themeDefaults.topbarGradientStart)
            : __tmNormalizeHexColor(SettingsStore.data.topbarGradientLightStart, themeDefaults.topbarGradientStart);
        const end = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.topbarGradientDarkEnd, themeDefaults.topbarGradientEnd)
            : __tmNormalizeHexColor(SettingsStore.data.topbarGradientLightEnd, themeDefaults.topbarGradientEnd);
        const topbarAppearance = __tmGetTopbarControlAppearance(isDark);
        const topbarText = topbarAppearance.topbarText;
        const taskColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.taskContentColorDark, themeDefaults.taskContentColor)
            : __tmNormalizeHexColor(SettingsStore.data.taskContentColorLight, themeDefaults.taskContentColor);
        const taskMetaColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.taskMetaColorDark, themeDefaults.taskMetaColor)
            : __tmNormalizeHexColor(SettingsStore.data.taskMetaColorLight, themeDefaults.taskMetaColor);
        const docGroupColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.groupDocLabelColorDark, themeDefaults.groupDocLabelColor)
            : __tmNormalizeHexColor(SettingsStore.data.groupDocLabelColorLight, themeDefaults.groupDocLabelColor);
        const timeBase = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, themeDefaults.timeGroupBaseColor)
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, themeDefaults.timeGroupBaseColor);
        const timeOverdue = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, themeDefaults.timeGroupOverdueColor)
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, themeDefaults.timeGroupOverdueColor);
        const calendarTodayHighlight = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.calendarTodayHighlightColorDark, themeDefaults.calendarTodayHighlightColor)
            : __tmNormalizeHexColor(SettingsStore.data.calendarTodayHighlightColorLight, themeDefaults.calendarTodayHighlightColor);
        const calendarGridBorder = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.calendarGridBorderColorDark, themeDefaults.calendarGridBorderColor)
            : __tmNormalizeHexColor(SettingsStore.data.calendarGridBorderColorLight, themeDefaults.calendarGridBorderColor);
        const tableBorder = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.tableBorderColorDark, themeDefaults.tableBorderColor)
            : __tmNormalizeHexColor(SettingsStore.data.tableBorderColorLight, themeDefaults.tableBorderColor);
        const controlText = topbarAppearance.controlText;
        const controlBg = topbarAppearance.controlBg;
        const controlBorder = topbarAppearance.controlBorder;
        const controlHover = topbarAppearance.controlHover;
        const segBg = topbarAppearance.segBg;
        const segBorder = __tmWithAlpha(controlText || topbarText || '#ffffff', 0.26);
        const segText = __tmWithAlpha(controlText || topbarText || '#ffffff', 0.86);
        const segSep = __tmWithAlpha(controlText || topbarText || '#ffffff', 0.22);
        const segHover = controlHover;
        const segActive = topbarAppearance.segActive;
        const segActiveHover = topbarAppearance.segActive;
        const searchBg = __tmMixThemeColors(palette.popover, palette.background, isDark ? 0.18 : 0.22);
        const searchText = palette.foreground;
        const searchBorder = __tmWithAlpha(controlText || topbarText || palette.foreground, 0.3);
        const thumb = __tmWithAlpha(controlText || topbarText || '#ffffff', 0.25);
        const hoverBg = __tmMixThemeColors(palette.background, palette.accent, isDark ? 0.34 : 0.22);
        const sectionBg = __tmMixThemeColors(palette.secondary, palette.background, isDark ? 0.24 : 0.18);
        const headerBg = __tmMixThemeColors(palette.background, palette.secondary, isDark ? 0.22 : 0.18);
        const tableHeaderBg = palette.muted;
        const inputBg = __tmMixThemeColors(palette.background, palette.card, isDark ? 0.22 : 0.12);
        const docItemBg = __tmMixThemeColors(palette.card, palette.background, 0.12);
        const docItemHover = __tmMixThemeColors(palette.background, palette.accent, isDark ? 0.44 : 0.28);
        const docCountBg = __tmWithAlpha(palette.primary, isDark ? 0.24 : 0.14);
        const infoBg = __tmMixThemeColors(palette.background, palette.primary, isDark ? 0.22 : 0.08);
        const infoBorder = __tmMixThemeColors(palette.primary, palette.border, 0.18);
        const subgroupBg = __tmMixThemeColors(palette.secondary, palette.background, isDark ? 0.34 : 0.42);
        const emptyCellBg = __tmMixThemeColors(palette.secondary, palette.background, isDark ? 0.42 : 0.58);
        const taskDoneColor = __tmMixThemeColors(palette.foreground, palette.background, isDark ? 0.56 : 0.62);
        const whiteboardGridColor = __tmWithAlpha(palette.border, isDark ? 0.42 : 0.55);
        const whiteboardStreamTreeLineColor = __tmWithAlpha(palette.border, isDark ? 0.5 : 0.62);
        const taskLeadingRingBg = __tmMixThemeColors(palette.card, palette.background, 0.2, 0.95);
        const taskLeadingRingBorder = __tmWithAlpha(palette.border, isDark ? 0.48 : 0.32);
        const modalOverlay = isDark ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.42)';

        try { root.style.setProperty('--background', palette.background); } catch (e) {}
        try { root.style.setProperty('--foreground', palette.foreground); } catch (e) {}
        try { root.style.setProperty('--card', palette.card); } catch (e) {}
        try { root.style.setProperty('--card-foreground', palette.cardForeground); } catch (e) {}
        try { root.style.setProperty('--popover', palette.popover); } catch (e) {}
        try { root.style.setProperty('--popover-foreground', palette.popoverForeground); } catch (e) {}
        try { root.style.setProperty('--primary', palette.primary); } catch (e) {}
        try { root.style.setProperty('--primary-foreground', palette.primaryForeground); } catch (e) {}
        try { root.style.setProperty('--secondary', palette.secondary); } catch (e) {}
        try { root.style.setProperty('--secondary-foreground', palette.secondaryForeground); } catch (e) {}
        try { root.style.setProperty('--muted', palette.muted); } catch (e) {}
        try { root.style.setProperty('--muted-foreground', palette.mutedForeground); } catch (e) {}
        try { root.style.setProperty('--accent', palette.accent); } catch (e) {}
        try { root.style.setProperty('--accent-foreground', palette.accentForeground); } catch (e) {}
        try { root.style.setProperty('--destructive', palette.destructive); } catch (e) {}
        try { root.style.setProperty('--destructive-foreground', palette.destructiveForeground); } catch (e) {}
        try { root.style.setProperty('--border', palette.border); } catch (e) {}
        try { root.style.setProperty('--input', palette.input); } catch (e) {}
        try { root.style.setProperty('--ring', palette.ring); } catch (e) {}
        try { root.style.setProperty('--tm-bg-color', palette.background); } catch (e) {}
        try { root.style.setProperty('--tm-text-color', palette.foreground); } catch (e) {}
        try { root.style.setProperty('--tm-border-color', palette.border); } catch (e) {}
        try { root.style.setProperty('--tm-hover-bg', hoverBg); } catch (e) {}
        try { root.style.setProperty('--tm-modal-overlay', modalOverlay); } catch (e) {}
        try { root.style.setProperty('--tm-header-bg', headerBg); } catch (e) {}
        try { root.style.setProperty('--tm-input-bg', inputBg); } catch (e) {}
        try { root.style.setProperty('--tm-input-border', palette.input); } catch (e) {}
        try { root.style.setProperty('--tm-table-header-bg', tableHeaderBg); } catch (e) {}
        try { root.style.setProperty('--tm-table-border', palette.border); } catch (e) {}
        try { root.style.setProperty('--tm-task-done-color', taskDoneColor); } catch (e) {}
        try { root.style.setProperty('--tm-doc-item-bg', docItemBg); } catch (e) {}
        try { root.style.setProperty('--tm-doc-item-hover', docItemHover); } catch (e) {}
        try { root.style.setProperty('--tm-doc-count-bg', docCountBg); } catch (e) {}
        try { root.style.setProperty('--tm-doc-count-color', palette.primary); } catch (e) {}
        try { root.style.setProperty('--tm-rule-group-bg', sectionBg); } catch (e) {}
        try { root.style.setProperty('--tm-rule-item-bg', docItemBg); } catch (e) {}
        try { root.style.setProperty('--tm-subgroup-bg', subgroupBg); } catch (e) {}
        try { root.style.setProperty('--tm-primary-color', palette.primary); } catch (e) {}
        try { root.style.setProperty('--tm-success-color', palette.success); } catch (e) {}
        try { root.style.setProperty('--tm-warning-color', palette.warning); } catch (e) {}
        try { root.style.setProperty('--tm-info-color', palette.info); } catch (e) {}
        try { root.style.setProperty('--tm-danger-color', palette.destructive); } catch (e) {}
        try { root.style.setProperty('--tm-quadrant-red', palette.destructive); } catch (e) {}
        try { root.style.setProperty('--tm-quadrant-yellow', palette.warning); } catch (e) {}
        try { root.style.setProperty('--tm-quadrant-blue', palette.primary); } catch (e) {}
        try { root.style.setProperty('--tm-quadrant-green', palette.success); } catch (e) {}
        try { root.style.setProperty('--tm-info-bg', infoBg); } catch (e) {}
        try { root.style.setProperty('--tm-info-border', infoBorder); } catch (e) {}
        try { root.style.setProperty('--tm-section-bg', sectionBg); } catch (e) {}
        try { root.style.setProperty('--tm-sidebar-bg', palette.sidebar); } catch (e) {}
        try { root.style.setProperty('--tm-card-bg', palette.card); } catch (e) {}
        try { root.style.setProperty('--tm-empty-cell-bg', emptyCellBg); } catch (e) {}
        try { root.style.setProperty('--tm-ui-background', palette.background); } catch (e) {}
        try { root.style.setProperty('--tm-ui-foreground', palette.foreground); } catch (e) {}
        try { root.style.setProperty('--tm-ui-card', palette.card); } catch (e) {}
        try { root.style.setProperty('--tm-ui-popover', palette.popover); } catch (e) {}
        try { root.style.setProperty('--tm-ui-primary', palette.primary); } catch (e) {}
        try { root.style.setProperty('--tm-ui-primary-foreground', palette.primaryForeground); } catch (e) {}
        try { root.style.setProperty('--tm-ui-secondary', palette.secondary); } catch (e) {}
        try { root.style.setProperty('--tm-ui-secondary-foreground', palette.secondaryForeground); } catch (e) {}
        try { root.style.setProperty('--tm-ui-muted', palette.muted); } catch (e) {}
        try { root.style.setProperty('--tm-ui-muted-foreground', palette.mutedForeground); } catch (e) {}
        try { root.style.setProperty('--tm-ui-accent', palette.accent); } catch (e) {}
        try { root.style.setProperty('--tm-ui-accent-foreground', palette.accentForeground); } catch (e) {}
        try { root.style.setProperty('--tm-ui-border', palette.border); } catch (e) {}
        try { root.style.setProperty('--tm-ui-input', palette.input); } catch (e) {}
        try { root.style.setProperty('--tm-ui-ring', palette.ring); } catch (e) {}
        try { root.style.setProperty('--tm-whiteboard-grid-color', whiteboardGridColor); } catch (e) {}
        try { root.style.setProperty('--tm-whiteboard-stream-tree-line-color', whiteboardStreamTreeLineColor); } catch (e) {}
        try { root.style.setProperty('--tm-task-leading-ring-bg', taskLeadingRingBg); } catch (e) {}
        try { root.style.setProperty('--tm-task-leading-ring-border', taskLeadingRingBorder); } catch (e) {}
        try { if (start) root.style.setProperty('--tm-topbar-grad-start', start); } catch (e) {}
        try { if (end) root.style.setProperty('--tm-topbar-grad-end', end); } catch (e) {}
        try { if (topbarText) root.style.setProperty('--tm-topbar-text-color', topbarText); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-bg', controlBg); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-text', controlText); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-border', controlBorder); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-hover', controlHover); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-radius', `${topbarAppearance.radiusPx}px`); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-border-width', `${topbarAppearance.borderWidthPx}px`); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-control-shadow', topbarAppearance.shadow); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-bg', segBg); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-border', segBorder); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-item-text', segText); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-item-sep', segSep); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-item-hover', segHover); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-item-active-bg', segActive); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-seg-item-active-hover', segActiveHover); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-search-bg', searchBg); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-search-text', searchText); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-search-border', searchBorder); } catch (e) {}
        try { root.style.setProperty('--tm-topbar-scrollbar-thumb', thumb); } catch (e) {}
        try { if (taskColor) root.style.setProperty('--tm-task-content-color', taskColor); } catch (e) {}
        try { if (taskMetaColor) root.style.setProperty('--tm-task-meta-color', taskMetaColor); } catch (e) {}
        try { if (docGroupColor) root.style.setProperty('--tm-group-doc-label-color', docGroupColor); } catch (e) {}
        try { if (timeBase) root.style.setProperty('--tm-time-group-base-color', timeBase); } catch (e) {}
        try { if (timeOverdue) root.style.setProperty('--tm-time-group-overdue-color', timeOverdue); } catch (e) {}
        try { if (calendarTodayHighlight) root.style.setProperty('--tm-calendar-today-highlight-color', calendarTodayHighlight); } catch (e) {}
        try { if (calendarGridBorder) root.style.setProperty('--tm-calendar-grid-border-color', calendarGridBorder); } catch (e) {}
        try { if (tableBorder) root.style.setProperty('--tm-table-border-color', tableBorder); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('tm:appearance-theme-updated', { detail: { ts: Date.now(), source: themeConfig.source, presetId: themeConfig.presetId } })); } catch (e) {}
    }

    function __tmDocHasUndoneTasks(doc) {
        if (!doc || !Array.isArray(doc.tasks) || doc.tasks.length === 0) return false;
        let hasUndone = false;
        const walk = (list, ancestorDone = false) => {
            for (const t of list) {
                const selfDone = !!t?.done;
                const blocked = ancestorDone || selfDone;
                if (!blocked) {
                    hasUndone = true;
                    return;
                }
                if (Array.isArray(t?.children) && t.children.length > 0) {
                    walk(t.children, blocked);
                }
                if (hasUndone) return;
            }
        };
        walk(doc.tasks, false);
        return hasUndone;
    }

    function hint(msg, type) {
        try {
            if (window.__tmBasecoat?.toast) {
                return window.__tmBasecoat.toast({
                    title: String(msg || '').trim(),
                    variant: String(type || 'info').trim() || 'info',
                    duration: 2500,
                });
            }
        } catch (e) {}
        const colors = { success: 'var(--tm-success-color)', error: 'var(--tm-danger-color)', info: 'var(--tm-primary-color)', warning: 'var(--tm-warning-color, #f9ab00)' };
        const el = document.createElement('div');
        el.className = 'tm-hint';
        el.style.background = colors[type] || '#666';
        if (!__tmIsMobileDevice()) el.style.top = '35px';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
        return el;
    }

    function __tmRemoveHint(hintEl) {
        if (!(hintEl instanceof HTMLElement)) return;
        try { hintEl.remove(); } catch (e) {}
    }

    const __TM_TASK_DONE_DELIGHT_MESSAGES = [
        '又拿下一条',
        '这条已经体面退场',
        '清掉一个，小赚一点轻松',
        '这一条，拿下',
        '很好，列表又清爽了一点',
        '这项已经搬出脑内常驻区',
        '漂亮，刚刚那一下很利落',
        '这条我先替你收好了',
        '清单里少了一个牵挂',
        '好，待办又瘦了一点',
        '这项已经归档到安心区',
        '列表安静了一点'
    ];
    const __TM_TASK_DONE_DELIGHT_EASTER_MESSAGES = [
        '咔哒，这条下班了',
        '很好，压力值 -1',
        '待办宇宙失去一名居民',
        '又送走一个待办小怪',
        '这条终于不用盯着你了',
        '任务刚刚偷偷点了个头'
    ];
    let __tmTaskDoneDelightLastMessage = '';

    function __tmIsTaskDoneDelightEnabled() {
        return SettingsStore?.data?.taskDoneDelightEnabled !== false;
    }

    function __tmPickTaskDoneDelightMessage() {
        const pool = Math.random() < 0.2 ? __TM_TASK_DONE_DELIGHT_EASTER_MESSAGES : __TM_TASK_DONE_DELIGHT_MESSAGES;
        if (!Array.isArray(pool) || !pool.length) return '✅ 任务已完成';
        let picked = String(pool[Math.floor(Math.random() * pool.length)] || '').trim();
        if (pool.length > 1 && picked === __tmTaskDoneDelightLastMessage) {
            const idx = Math.max(0, pool.indexOf(picked));
            picked = String(pool[(idx + 1) % pool.length] || '').trim() || picked;
        }
        __tmTaskDoneDelightLastMessage = picked;
        return picked || '✅ 任务已完成';
    }

    function __tmBuildTaskDoneSuccessHint(done, fallbackText = '✅ 任务已完成') {
        if (!done) return '✅ 已取消完成';
        if (!__tmIsTaskDoneDelightEnabled()) return String(fallbackText || '✅ 任务已完成').trim() || '✅ 任务已完成';
        return __tmPickTaskDoneDelightMessage();
    }

    function __tmTaskDoneDelightMotionDisabled() {
        try {
            return __tmPopupMotionDisabled();
        } catch (e) {
            return false;
        }
    }

    function __tmEscapeCssSelectorValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(raw);
        } catch (e) {}
        return raw.replace(/["\\]/g, '\\$&');
    }

    function __tmRestartTransientClass(node, className, duration = 720) {
        if (!(node instanceof HTMLElement)) return;
        const cls = String(className || '').trim();
        if (!cls) return;
        try {
            node.classList.remove(cls);
            void node.offsetWidth;
            node.classList.add(cls);
        } catch (e) {
            return;
        }
        try {
            if (node.__tmTransientClassTimers && node.__tmTransientClassTimers[cls]) clearTimeout(node.__tmTransientClassTimers[cls]);
        } catch (e) {}
        try {
            if (!node.__tmTransientClassTimers || typeof node.__tmTransientClassTimers !== 'object') node.__tmTransientClassTimers = {};
            node.__tmTransientClassTimers[cls] = setTimeout(() => {
                try { node.classList.remove(cls); } catch (e2) {}
                try {
                    if (node.__tmTransientClassTimers) delete node.__tmTransientClassTimers[cls];
                } catch (e2) {}
            }, Math.max(220, Number(duration) || 720));
        } catch (e) {}
    }

    function __tmCollectTaskDoneDelightTargets(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return [];
        const escaped = __tmEscapeCssSelectorValue(tid);
        if (!escaped) return [];
        const selectors = [
            `#tmTaskTable tbody tr[data-id="${escaped}"]`,
            `#tmTimelineLeftTable tbody tr[data-id="${escaped}"]`,
            `.tm-kanban-card[data-id="${escaped}"]`,
            `.tm-whiteboard-stream-task-head[data-id="${escaped}"]`,
            `.tm-whiteboard-stream-task-node[data-id="${escaped}"]`,
            `.tm-whiteboard-stream-task-head[data-task-id="${escaped}"]`,
            `.tm-whiteboard-stream-task-node[data-task-id="${escaped}"]`,
            `.tm-whiteboard-card[data-task-id="${escaped}"]`,
            `.tm-whiteboard-node[data-task-id="${escaped}"]`,
            `.tm-whiteboard-pool-item[data-task-id="${escaped}"]`,
            `.tm-gantt-row[data-id="${escaped}"]`
        ];
        const found = new Set();
        selectors.forEach((selector) => {
            try {
                document.querySelectorAll(selector).forEach((el) => {
                    if (el instanceof HTMLElement) found.add(el);
                });
            } catch (e) {}
        });
        return Array.from(found);
    }

    function __tmApplyTaskDoneDelight(taskId) {
        const targets = __tmCollectTaskDoneDelightTargets(taskId);
        if (!targets.length) return false;
        targets.forEach((target) => {
            if (!(target instanceof HTMLElement)) return;
            if (String(target.tagName || '').toLowerCase() === 'tr') {
                const cells = target.querySelectorAll('td');
                if (cells.length) {
                    cells.forEach((cell) => __tmRestartTransientClass(cell, 'tm-task-done-delight-cell', 760));
                } else {
                    __tmRestartTransientClass(target, 'tm-task-done-delight-surface', 760);
                }
            } else {
                __tmRestartTransientClass(target, 'tm-task-done-delight-surface', 760);
            }
            try {
                target.querySelectorAll('.tm-task-checkbox').forEach((checkbox) => {
                    if (checkbox instanceof HTMLElement) __tmRestartTransientClass(checkbox, 'tm-task-checkbox--delight', 520);
                });
            } catch (e) {}
        });
        return true;
    }

    function __tmQueueTaskDoneDelight(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || opts.done !== true) return false;
        if (!__tmIsTaskDoneDelightEnabled()) return false;
        if (opts.suppressHint === true) return false;
        if (String(opts.source || '').trim() === 'undo') return false;
        if (__tmTaskDoneDelightMotionDisabled()) return true;
        let tries = 0;
        const maxTries = 5;
        const run = () => {
            tries += 1;
            const ok = __tmApplyTaskDoneDelight(tid);
            if (!ok && tries < maxTries) setTimeout(run, tries * 90);
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(run);
        });
        return true;
    }

    async function __tmRefreshNotebookCache(force = false) {
        const now = Date.now();
        if (!force && Array.isArray(state.notebooks) && state.notebooks.length > 0 && (now - (Number(state.notebooksFetchedAt) || 0) < 60000)) {
            return state.notebooks;
        }
        if (state.notebooksLoadingPromise) return state.notebooksLoadingPromise;
        state.notebooksLoadingPromise = (async () => {
            try {
                const notebooks = await API.lsNotebooks();
                state.notebooks = Array.isArray(notebooks) ? notebooks : [];
                state.notebooksFetchedAt = Date.now();
            } catch (e) {
                state.notebooks = Array.isArray(state.notebooks) ? state.notebooks : [];
            } finally {
                state.notebooksLoadingPromise = null;
            }
            return state.notebooks;
        })();
        return state.notebooksLoadingPromise;
    }

    function __tmGetNotebookDisplayName(notebookId, fallback = '') {
        const id = String(notebookId || '').trim();
        if (!id) return String(fallback || '').trim() || '未命名笔记本';
        const notebooks = Array.isArray(state.notebooks) ? state.notebooks : [];
        const hit = notebooks.find((item) => String(item?.id || item?.box || '').trim() === id);
        return String(hit?.name || hit?.title || fallback || '').trim() || '未命名笔记本';
    }

    function __tmResolveDocGroupName(group) {
        if (!group || typeof group !== 'object') return '未命名分组';
        const notebookId = String(group.notebookId || '').trim();
        if (notebookId) return __tmGetNotebookDisplayName(notebookId, group.name);
        return String(group.name || '').trim() || '未命名分组';
    }

    function __tmNormalizeCalendarSearchOptimization(raw) {
        const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        const daysRaw = Number(source.days);
        const allow = new Set([30, 60, 90, 120]);
        const days = allow.has(daysRaw) ? daysRaw : 90;
        return {
            enabled: !!source.enabled,
            days
        };
    }

    function __tmNormalizeDocGroupExcludedDocIds(input) {
        const source = Array.isArray(input) ? input : [];
        const out = [];
        const seen = new Set();
        source.forEach((item) => {
            const id = String((typeof item === 'object' ? item?.id : item) || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmNormalizeDocGroupConfig(group, globalDocColorScheme = null) {
        if (!group || typeof group !== 'object') return null;
        const id = String(group.id || '').trim();
        if (!id) return null;
        const notebookId = String(group.notebookId || '').trim();
        const docs = Array.isArray(group.docs) ? group.docs : [];
        const excludedDocIds = __tmNormalizeDocGroupExcludedDocIds(group.excludedDocIds);
        const otherBlockRefs = __tmNormalizeOtherBlockRefs(group.otherBlockRefs);
        const normalizedGlobalScheme = __tmNormalizeDocColorSchemeConfig(globalDocColorScheme, {
            seedFallback: Number(globalDocColorScheme?.seed) || 1
        });
        const normalizedDocs = [];
        const seen = new Set();
        docs.forEach((doc) => {
            const docId = String((typeof doc === 'object' ? doc?.id : doc) || '').trim();
            if (!docId || seen.has(docId)) return;
            seen.add(docId);
            normalizedDocs.push({
                id: docId,
                recursive: !!(typeof doc === 'object' ? doc?.recursive : false)
            });
        });
        return {
            ...group,
            id,
            name: String(group.name || '').trim(),
            notebookId,
            docs: normalizedDocs,
            excludedDocIds,
            otherBlockRefs,
            docColorConfig: __tmNormalizeDocColorSchemeConfig(group.docColorConfig, {
                allowInherit: true,
                seedFallback: normalizedGlobalScheme.seed
            }),
            calendarSearchOptimization: __tmNormalizeCalendarSearchOptimization(group.calendarSearchOptimization)
        };
    }

    function __tmGetGroupCalendarSearchOptimization(group) {
        return __tmNormalizeCalendarSearchOptimization(group?.calendarSearchOptimization);
    }

    function __tmGetGroupExcludedDocIds(group) {
        return __tmNormalizeDocGroupExcludedDocIds(group?.excludedDocIds);
    }

    function __tmGetAllDocsExcludedDocIds() {
        return __tmNormalizeDocGroupExcludedDocIds(SettingsStore?.data?.allDocsExcludedDocIds);
    }

    function __tmGetExcludedDocIdsForGroup(groupId) {
        const gid = String(groupId || 'all').trim() || 'all';
        if (gid === 'all') return __tmGetAllDocsExcludedDocIds();
        return __tmGetGroupExcludedDocIds(__tmGetDocGroupById(gid));
    }

    function __tmExtractCalendarDateFromText(text, options = {}) {
        const source = String(text || '').trim();
        if (!source) return null;
        const allowShort = !!options?.allowShort;
        const refYearRaw = Number(options?.refYear);
        const refYear = Number.isFinite(refYearRaw) && refYearRaw >= 1900 && refYearRaw <= 2100
            ? Math.floor(refYearRaw)
            : new Date().getFullYear();
        let match = source.match(/(?:^|[^\d])((?:19|20)\d{2})[-\/_.年](0?[1-9]|1[0-2])[-\/_.月](0?[1-9]|[12]\d|3[01])(?:日)?(?!\d)/);
        if (!match) {
            match = source.match(/(?:^|[^\d])((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/);
        }
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const date = new Date(year, month - 1, day);
            if (
                !Number.isFinite(date.getTime())
                || date.getFullYear() !== year
                || date.getMonth() !== month - 1
                || date.getDate() !== day
            ) {
                return null;
            }
            return date;
        }
        if (!allowShort) return null;
        let shortMatch = source.match(/(?:^|[^\d])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/);
        if (!shortMatch) {
            shortMatch = source.match(/(?:^|[^\d])(0?[1-9]|1[0-2])[-\/_.月](0?[1-9]|[12]\d|3[01])(?:日)?(?!\d)/);
        }
        if (!shortMatch) return null;
        const month = Number(shortMatch[1]);
        const day = Number(shortMatch[2]);
        const date = new Date(refYear, month - 1, day);
        if (
            !Number.isFinite(date.getTime())
            || date.getFullYear() !== refYear
            || date.getMonth() !== month - 1
            || date.getDate() !== day
        ) {
            return null;
        }
        return date;
    }

    function __tmExtractDailyNoteDateFromAttrName(name) {
        const source = String(name || '').trim();
        if (!source) return null;
        const m = source.match(/^dailynote-((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/i);
        if (!m) return null;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const d = new Date(year, month - 1, day);
        if (
            !Number.isFinite(d.getTime())
            || d.getFullYear() !== year
            || d.getMonth() !== month - 1
            || d.getDate() !== day
        ) {
            return null;
        }
        return d;
    }

    async function __tmLoadCalendarDocAttrDateMap(docIds, docsMeta = []) {
        const ids = Array.isArray(docIds) ? docIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
        const out = new Map();
        if (!ids.length) return out;
        const escapeSql = (v) => String(v || '').replace(/'/g, "''");
        const yearByDocId = new Map();
        (Array.isArray(docsMeta) ? docsMeta : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id || yearByDocId.has(id)) return;
            const createdTs = __tmParseDocCreatedTs(doc?.created);
            if (!Number.isFinite(createdTs) || createdTs <= 0) return;
            const d = new Date(createdTs);
            const y = Number(d.getFullYear());
            if (!Number.isFinite(y) || y < 1900 || y > 2100) return;
            yearByDocId.set(id, y);
        });
        const scoreHit = (name, value, byValue) => {
            const n = String(name || '').trim().toLowerCase();
            const v = String(value || '').trim();
            let score = byValue ? 20 : 10;
            if (/^(?:19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(v)) score += 220;
            if (/^dailynote-(?:19|20)\d{6}$/i.test(n)) score += 240;
            if (n.includes('dailynote') || n.includes('daily') || n.includes('日记')) score += 100;
            if (n.startsWith('custom-')) score += 5;
            if (/^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(n)) score += 80;
            if (/^(?:custom-)?(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(n)) score += 80;
            return score;
        };
        const best = new Map();
        const chunkSize = 180;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            if (!chunk.length) continue;
            const inSql = chunk.map((id) => `'${escapeSql(id)}'`).join(',');
            const sql = `
                SELECT block_id, name, value
                FROM attributes
                WHERE block_id IN (${inSql})
            `;
            let rows = [];
            try {
                const res = await API.call('/api/query/sql', { stmt: sql });
                rows = (res && res.code === 0 && Array.isArray(res.data)) ? res.data : [];
            } catch (e) {
                rows = [];
            }
            rows.forEach((row) => {
                const blockId = String(row?.block_id || '').trim();
                if (!blockId) return;
                const name = String(row?.name || '').trim();
                const value = String(row?.value || '').trim();
                const refYear = yearByDocId.get(blockId) || new Date().getFullYear();
                const dateFromStrictDailyNoteName = __tmExtractDailyNoteDateFromAttrName(name);
                const dateFromValue = __tmExtractCalendarDateFromText(value, { allowShort: true, refYear });
                const dateFromName = __tmExtractCalendarDateFromText(name, { allowShort: true, refYear });
                const hit = dateFromStrictDailyNoteName || dateFromValue || dateFromName;
                if (!(hit instanceof Date) || Number.isNaN(hit.getTime())) return;
                const score = scoreHit(name, value, !!dateFromValue);
                const prev = best.get(blockId);
                if (!prev || score > prev.score) {
                    best.set(blockId, { score, date: hit });
                }
            });
        }
        best.forEach((item, blockId) => {
            if (!(item?.date instanceof Date) || Number.isNaN(item.date.getTime())) return;
            out.set(blockId, item.date);
        });
        return out;
    }

    function __tmResolveCalendarDocDate(meta) {
        if (!meta || typeof meta !== 'object') return null;
        const attrDate = meta.attrDate;
        if (attrDate instanceof Date && !Number.isNaN(attrDate.getTime())) return attrDate;
        return __tmExtractCalendarDateFromText(meta.path)
            || __tmExtractCalendarDateFromText(meta.hpath)
            || __tmExtractCalendarDateFromText(meta.name)
            || (() => {
                const createdTs = __tmParseDocCreatedTs(meta.created);
                if (!Number.isFinite(createdTs) || createdTs <= 0) return null;
                const created = new Date(createdTs);
                if (!Number.isFinite(created.getTime())) return null;
                return new Date(created.getFullYear(), created.getMonth(), created.getDate());
            })()
            || null;
    }

    async function __tmEnsureDocMetaIndexForCalendarOptimization() {
        if (Array.isArray(state.allDocuments) && state.allDocuments.length > 0) return state.allDocuments;
        try {
            const docs = await API.getAllDocuments();
            if (Array.isArray(docs) && docs.length > 0) {
                state.allDocuments = docs;
                __tmAllDocumentsFetchedAt = Date.now();
                return docs;
            }
        } catch (e) {}
        return Array.isArray(state.allDocuments) ? state.allDocuments : [];
    }

    const __tmCalendarDocWindowCache = new Map();
    async function __tmApplyCalendarSearchOptimizationToDocIds(docIds, group) {
        const optimization = __tmGetGroupCalendarSearchOptimization(group);
        const ids = Array.isArray(docIds) ? docIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
        if (!optimization.enabled || !ids.length) return ids;

        const docs = await __tmEnsureDocMetaIndexForCalendarOptimization();
        const docAttrDateMap = await __tmLoadCalendarDocAttrDateMap(ids, docs);
        const docKey = ids.join(',');
        const cacheKey = `${String(group?.id || '').trim()}|${optimization.days}|${docKey}|${Number(__tmAllDocumentsFetchedAt) || 0}|${Array.isArray(docs) ? docs.length : 0}`;
        const cached = __tmCalendarDocWindowCache.get(cacheKey);
        if (cached && Array.isArray(cached.ids)) return cached.ids.slice();

        const docMetaMap = new Map();
        (Array.isArray(docs) ? docs : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id || docMetaMap.has(id)) return;
            docMetaMap.set(id, {
                id,
                name: String(doc?.name || doc?.content || '').trim(),
                path: String(doc?.path || '').trim(),
                hpath: String(doc?.hpath || '').trim(),
                created: String(doc?.created || '').trim(),
                attrDate: docAttrDateMap.get(id) || null
            });
        });
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id || docMetaMap.has(id)) return;
            docMetaMap.set(id, {
                id,
                name: String(doc?.name || '').trim(),
                path: '',
                hpath: '',
                created: String(doc?.created || '').trim(),
                attrDate: docAttrDateMap.get(id) || null
            });
        });

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const filtered = [];
        let matchedCalendarDocs = 0;
        ids.forEach((id) => {
            const docDate = __tmResolveCalendarDocDate(docMetaMap.get(id));
            if (!(docDate instanceof Date) || Number.isNaN(docDate.getTime())) {
                filtered.push(id);
                return;
            }
            matchedCalendarDocs += 1;
            const diffDays = Math.floor((today.getTime() - docDate.getTime()) / 86400000);
            if (diffDays >= 0 && diffDays < optimization.days) filtered.push(id);
        });

        const result = matchedCalendarDocs > 0 ? filtered : ids;
        if (__tmCalendarDocWindowCache.size > 12) __tmCalendarDocWindowCache.clear();
        __tmCalendarDocWindowCache.set(cacheKey, { ids: result.slice(), t: Date.now() });
        return result;
    }

    function __tmNormalizeGroupModeValue(mode, fallback = 'none') {
        const value = String(mode || '').trim();
        return ['none', 'doc', 'time', 'quadrant', 'task'].includes(value) ? value : String(fallback || 'none').trim() || 'none';
    }

    function __tmNormalizeRuleIdValue(ruleId) {
        const value = String(ruleId || '').trim();
        return value || null;
    }

    function __tmNormalizeViewProfile(profile, fallback = {}) {
        const source = (profile && typeof profile === 'object' && !Array.isArray(profile)) ? profile : {};
        const hasRuleId = Object.prototype.hasOwnProperty.call(source, 'ruleId');
        const hasCurrentRule = Object.prototype.hasOwnProperty.call(source, 'currentRule');
        const rawRuleId = hasRuleId
            ? source.ruleId
            : (hasCurrentRule ? source.currentRule : fallback.ruleId);
        return {
            ruleId: __tmNormalizeRuleIdValue(rawRuleId),
            groupMode: __tmNormalizeGroupModeValue(source.groupMode ?? fallback.groupMode, fallback.groupMode || 'none')
        };
    }

    function __tmNormalizeViewProfiles(raw, fallbackGlobal = {}) {
        const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        const allTabs0 = (source.allTabs && typeof source.allTabs === 'object' && !Array.isArray(source.allTabs)) ? source.allTabs : {};
        const groups0 = (source.groups && typeof source.groups === 'object' && !Array.isArray(source.groups)) ? source.groups : {};
        const docs0 = (source.docs && typeof source.docs === 'object' && !Array.isArray(source.docs)) ? source.docs : {};
        const allTabs = {};
        const groups = {};
        const docs = {};
        Object.keys(allTabs0).forEach((key) => {
            const gid = String(key || '').trim();
            if (!gid) return;
            allTabs[gid] = __tmNormalizeViewProfile(allTabs0[key], fallbackGlobal);
        });
        Object.keys(groups0).forEach((key) => {
            const gid = String(key || '').trim();
            if (!gid) return;
            groups[gid] = __tmNormalizeViewProfile(groups0[key], fallbackGlobal);
        });
        Object.keys(docs0).forEach((key) => {
            const did = String(key || '').trim();
            if (!did) return;
            docs[did] = __tmNormalizeViewProfile(docs0[key], fallbackGlobal);
        });
        return {
            global: __tmNormalizeViewProfile(source.global, fallbackGlobal),
            allTabs,
            groups,
            docs
        };
    }

    function __tmGetCurrentGroupModeValue() {
        if (state.quadrantEnabled) return 'quadrant';
        if (state.groupByTaskName) return 'task';
        if (state.groupByTime) return 'time';
        if (state.groupByDocName) return 'doc';
        return 'none';
    }

    function __tmFindRuleById(ruleId) {
        const id = String(ruleId || '').trim();
        if (!id) return null;
        const sources = [
            Array.isArray(state.filterRules) ? state.filterRules : [],
            Array.isArray(SettingsStore?.data?.filterRules) ? SettingsStore.data.filterRules : []
        ];
        for (const list of sources) {
            const found = list.find((rule) => String(rule?.id || '').trim() === id);
            if (found) return found;
        }
        return null;
    }

    function __tmRuleNeedsDoneOnly(ruleOrId) {
        const rule = (ruleOrId && typeof ruleOrId === 'object')
            ? ruleOrId
            : __tmFindRuleById(ruleOrId);
        return !!(rule && Array.isArray(rule.conditions) && rule.conditions.some((c) => {
            if (!c || c.field !== 'done' || c.operator !== '=') return false;
            return (c.value === true || String(c.value) === 'true' || c.value === '') && String(c.value) !== '__all__';
        }));
    }

    function __tmGetViewProfilesStore() {
        const fallback = {
            ruleId: SettingsStore?.data?.currentRule,
            groupMode: SettingsStore?.data?.groupMode
        };
        const normalized = __tmNormalizeViewProfiles(SettingsStore?.data?.viewProfiles, fallback);
        if (SettingsStore?.data) SettingsStore.data.viewProfiles = normalized;
        return normalized;
    }

    function __tmGetStoredGroupViewProfile(groupId) {
        const gid = String(groupId || 'all').trim() || 'all';
        const store = __tmGetViewProfilesStore();
        return store.groups[gid] ? __tmNormalizeViewProfile(store.groups[gid], store.global) : null;
    }

    function __tmGetStoredAllTabsViewProfile(groupId) {
        const gid = String(groupId || 'all').trim() || 'all';
        const store = __tmGetViewProfilesStore();
        return store.allTabs[gid] ? __tmNormalizeViewProfile(store.allTabs[gid], store.global) : null;
    }

    function __tmGetStoredDocViewProfile(docId) {
        const did = String(docId || '').trim();
        if (!did) return null;
        const store = __tmGetViewProfilesStore();
        return store.docs[did] ? __tmNormalizeViewProfile(store.docs[did], store.global) : null;
    }

    function __tmGetCurrentUiViewProfile() {
        return __tmNormalizeViewProfile({
            ruleId: state.currentRule,
            groupMode: __tmGetCurrentGroupModeValue()
        }, {
            ruleId: SettingsStore?.data?.currentRule,
            groupMode: SettingsStore?.data?.groupMode
        });
    }

    function __tmApplyViewProfileToRuntime(profile) {
        const fallback = {
            ruleId: SettingsStore?.data?.currentRule,
            groupMode: SettingsStore?.data?.groupMode
        };
        const normalized = __tmNormalizeViewProfile(profile, fallback);
        const rule = __tmFindRuleById(normalized.ruleId);
        const nextRuleId = rule ? String(rule.id || '').trim() : null;
        const prevDoneOnly = !!state.__tmQueryDoneOnly;
        const groupMode = __tmNormalizeGroupModeValue(normalized.groupMode, 'none');

        state.currentRule = nextRuleId;
        SettingsStore.data.currentRule = nextRuleId;
        SettingsStore.data.groupMode = groupMode;
        SettingsStore.data.groupByDocName = groupMode === 'doc';
        SettingsStore.data.groupByTime = groupMode === 'time';
        if (groupMode === 'task') SettingsStore.data.groupByTaskName = true;
        SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
        SettingsStore.data.quadrantConfig.enabled = groupMode === 'quadrant';

        state.groupByDocName = groupMode === 'doc';
        state.groupByTaskName = groupMode === 'task';
        state.groupByTime = groupMode === 'time';
        state.quadrantEnabled = groupMode === 'quadrant';

        const nextDoneOnly = __tmRuleNeedsDoneOnly(rule);
        state.__tmQueryDoneOnly = nextDoneOnly;

        return {
            profile: { ruleId: nextRuleId, groupMode },
            prevDoneOnly,
            nextDoneOnly,
            doneOnlyChanged: prevDoneOnly !== nextDoneOnly
        };
    }

    function __tmGetEffectiveViewProfileForContext(docId = state.activeDocId, groupId = SettingsStore?.data?.currentGroupId) {
        const activeDocId = String(docId || 'all').trim() || 'all';
        const currentGroupId = String(groupId || 'all').trim() || 'all';
        const store = __tmGetViewProfilesStore();
        if (activeDocId !== 'all') {
            const docProfile = store.docs[activeDocId];
            if (docProfile) {
                return {
                    source: 'doc',
                    docId: activeDocId,
                    groupId: currentGroupId,
                    profile: __tmNormalizeViewProfile(docProfile, store.global)
                };
            }
        }
        if (activeDocId === 'all') {
            const allTabsProfile = store.allTabs[currentGroupId];
            if (allTabsProfile) {
                return {
                    source: 'allTabs',
                    docId: '',
                    groupId: currentGroupId,
                    profile: __tmNormalizeViewProfile(allTabsProfile, store.global)
                };
            }
        }
        const groupProfile = store.groups[currentGroupId];
        if (groupProfile) {
            return {
                source: 'group',
                docId: activeDocId !== 'all' ? activeDocId : '',
                groupId: currentGroupId,
                profile: __tmNormalizeViewProfile(groupProfile, store.global)
            };
        }
        return {
            source: 'default',
            docId: activeDocId !== 'all' ? activeDocId : '',
            groupId: currentGroupId,
            profile: __tmNormalizeViewProfile(store.global, {
                ruleId: SettingsStore?.data?.currentRule,
                groupMode: SettingsStore?.data?.groupMode
            })
        };
    }

    async function __tmApplyCurrentContextViewProfile() {
        try { await __tmEnsureFilterRulesLoaded(); } catch (e) {}
        const prevCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        const resolved = __tmGetEffectiveViewProfileForContext();
        const applied = __tmApplyViewProfileToRuntime(resolved.profile);
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        const customFieldReloadNeeded = __tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan);
        if (!customFieldReloadNeeded) {
            try {
                await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                    hydrateVisible: false,
                });
            } catch (e) {}
        }
        try { SettingsStore.syncToLocal(); } catch (e) {}
        return {
            ...resolved,
            ...applied,
            customFieldReloadNeeded,
            prevCustomFieldPlan,
            nextCustomFieldPlan,
        };
    }

    function __tmPersistGlobalViewProfileFromCurrentState(force = false) {
        const resolved = __tmGetEffectiveViewProfileForContext();
        if (!force && resolved.source !== 'default') return false;
        const store = __tmGetViewProfilesStore();
        store.global = __tmGetCurrentUiViewProfile();
        SettingsStore.data.viewProfiles = store;
        return true;
    }

    function __tmGetGroupModeLabel(mode) {
        const value = __tmNormalizeGroupModeValue(mode, 'none');
        if (value === 'doc') return '按文档';
        if (value === 'time') return '按时间';
        if (value === 'quadrant') return '四象限';
        if (value === 'task') return '按任务名';
        return '不分组';
    }

    function __tmGetViewProfileSourceLabel(source) {
        if (source === 'doc') return '页签自定义';
        if (source === 'allTabs') return '全部页签专用';
        if (source === 'group') return '分组默认';
        return '全局默认';
    }

    function __tmDescribeViewProfile(profile) {
        const normalized = __tmNormalizeViewProfile(profile, {
            ruleId: null,
            groupMode: 'none'
        });
        const ruleName = __tmFindRuleById(normalized.ruleId)?.name || '全部规则';
        return `${ruleName} / ${__tmGetGroupModeLabel(normalized.groupMode)}`;
    }

    function __tmNormalizeGroupDocEntries(group) {
        const docs = Array.isArray(group?.docs) ? group.docs : [];
        return docs.map((doc) => {
            const id = String((typeof doc === 'object' ? doc?.id : doc) || '').trim();
            if (!id) return null;
            return {
                id,
                kind: 'doc',
                recursive: !!(typeof doc === 'object' ? doc?.recursive : false)
            };
        }).filter(Boolean);
    }

    function __tmGetGroupSourceEntries(group) {
        const excludedDocIds = __tmGetGroupExcludedDocIds(group);
        const out = __tmNormalizeGroupDocEntries(group).map((entry) => ({
            ...entry,
            excludedDocIds: excludedDocIds.slice()
        }));
        const notebookId = String(group?.notebookId || '').trim();
        const calendarOptimization = __tmGetGroupCalendarSearchOptimization(group);
        if (notebookId) {
            out.push({
                id: notebookId,
                kind: 'notebook',
                recursive: true,
                calendarOptimization,
                excludedDocIds: excludedDocIds.slice()
            });
        }
        return out;
    }

    async function __tmExpandSourceEntryDocIds(entry, pushId) {
        if (!entry || typeof pushId !== 'function') return;
        const kind = String(entry.kind || 'doc').trim();
        const id = String(entry.id || '').trim();
        if (!id) return;
        const entryCalendarOptimization = __tmNormalizeCalendarSearchOptimization(entry?.calendarOptimization);
        const excludedDocIds = __tmNormalizeDocGroupExcludedDocIds(entry?.excludedDocIds);
        const excludedDocIdSet = new Set(excludedDocIds);
        const recursiveDocLimit = Number.isFinite(Number(SettingsStore.data?.recursiveDocLimit))
            ? Math.max(1, Math.min(500000, Math.round(Number(SettingsStore.data.recursiveDocLimit))))
            : 2000;
        const cacheKey = `${kind}:${id}:${entry.recursive ? 1 : 0}:${recursiveDocLimit}:${entryCalendarOptimization.enabled ? 1 : 0}:${Number(entryCalendarOptimization.days) || 0}:${excludedDocIds.join(',')}`;
        const now = Date.now();
        const cacheTtlMs = kind === 'notebook' ? 15000 : 10000;
        const cacheEnt = __tmDocExpandCache.get(cacheKey);
        if (cacheEnt && (now - Number(cacheEnt.t || 0)) < cacheTtlMs && Array.isArray(cacheEnt.ids)) {
            cacheEnt.ids.forEach((cid) => pushId(cid));
            return;
        }
        const nextIds = [];
        const pushLocal = (cid0) => {
            const cid = String(cid0 || '').trim();
            if (!cid) return;
            nextIds.push(cid);
            pushId(cid);
        };
        if (kind === 'notebook') {
            try {
                const docs = await API.getNotebookDocuments(id, entryCalendarOptimization.enabled ? { limit: 0 } : null);
                let notebookDocIds = (Array.isArray(docs) ? docs : []).map((doc) => String(doc?.id || '').trim()).filter(Boolean);
                if (entryCalendarOptimization.enabled && notebookDocIds.length > 0) {
                    const optimized = await __tmApplyCalendarSearchOptimizationToDocIds(notebookDocIds, {
                        id: `__tm-notebook-${id}`,
                        calendarSearchOptimization: entryCalendarOptimization,
                    });
                    notebookDocIds = Array.isArray(optimized) ? optimized : notebookDocIds;
                }
                if (excludedDocIdSet.size) {
                    notebookDocIds = notebookDocIds.filter((docId) => !excludedDocIdSet.has(String(docId || '').trim()));
                }
                if (notebookDocIds.length > recursiveDocLimit) notebookDocIds = notebookDocIds.slice(0, recursiveDocLimit);
                notebookDocIds.forEach((docId) => pushLocal(docId));
            } catch (e) {}
            __tmDocExpandCache.set(cacheKey, { t: Date.now(), ids: nextIds });
            return;
        }
        if (!excludedDocIdSet.has(id)) pushLocal(id);
        if (entry.recursive && API && typeof API.getSubDocIds === 'function') {
            try {
                let subIds = await API.getSubDocIds(id, entryCalendarOptimization.enabled ? { limit: 0 } : null);
                subIds = Array.isArray(subIds) ? subIds.map((sid) => String(sid || '').trim()).filter(Boolean) : [];
                if (entryCalendarOptimization.enabled && subIds.length > 0) {
                    const optimized = await __tmApplyCalendarSearchOptimizationToDocIds(subIds, {
                        id: `__tm-doc-${id}`,
                        calendarSearchOptimization: entryCalendarOptimization,
                    });
                    subIds = Array.isArray(optimized) ? optimized : subIds;
                }
                if (excludedDocIdSet.size) {
                    subIds = subIds.filter((sid) => !excludedDocIdSet.has(String(sid || '').trim()));
                }
                if (subIds.length > recursiveDocLimit) subIds = subIds.slice(0, recursiveDocLimit);
                subIds.forEach((sid) => pushLocal(sid));
            } catch (e) {}
        }
        __tmDocExpandCache.set(cacheKey, { t: Date.now(), ids: nextIds });
    }

    function __tmRenderChecklistPreserveScroll() {
        const modal = state.modal instanceof Element ? state.modal : null;
        const staged = (state.pendingChecklistRenderRestore && typeof state.pendingChecklistRenderRestore === 'object')
            ? state.pendingChecklistRenderRestore
            : null;
        const pane = modal?.querySelector?.('.tm-checklist-scroll');
        const detailPanel = modal ? __tmResolveChecklistDetailPanel(modal, { preferSheetMode: __tmChecklistUseSheetMode(modal) }).panel : null;
        const detailTaskId = String(detailPanel?.__tmTaskDetailTask?.id || detailPanel?.dataset?.tmDetailTaskId || state.detailTaskId || '').trim();
        const top = Number((staged && Number.isFinite(Number(staged.top))) ? Number(staged.top) : Number(pane?.scrollTop || 0));
        const left = Number((staged && Number.isFinite(Number(staged.left))) ? Number(staged.left) : Number(pane?.scrollLeft || 0));
        try { __tmPushRefreshDebug('checklist-render-preserve-scroll', { top, left }); } catch (e) {}
        if (detailTaskId) {
            try {
                __tmPushDetailDebug('detail-host-rerender-request', {
                    scope: 'checklist',
                    source: 'render-checklist-preserve-scroll',
                    taskId: detailTaskId,
                    pendingSave: detailPanel?.__tmTaskDetailPendingSave === true,
                    hasActivePopover: !!detailPanel?.__tmTaskDetailActiveInlinePopover,
                    refreshHoldMsLeft: Math.max(0, Number(detailPanel?.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                });
            } catch (e) {}
        }
        try {
            if (modal && __tmRerenderChecklistInPlace(modal)) {
                state.pendingChecklistRenderRestore = null;
                return;
            }
        } catch (e) {}
        render();
        state.pendingChecklistRenderRestore = null;
        try {
            const restore = () => {
                const nextPane = state.modal?.querySelector?.('.tm-checklist-scroll');
                if (!(nextPane instanceof HTMLElement)) return;
                nextPane.scrollTop = top;
                nextPane.scrollLeft = left;
                try { nextPane.__tmChecklistScrollUpdateThumb?.(); } catch (e3) {}
            };
            restore();
            requestAnimationFrame(restore);
            setTimeout(restore, 30);
            setTimeout(restore, 90);
        } catch (e) {}
    }

    function __tmCaptureChecklistRenderRestore() {
        const modal = state.modal instanceof Element ? state.modal : null;
        if (!(modal instanceof Element)) return null;
        if (!(globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist'))) return null;
        const pane = modal.querySelector('.tm-checklist-scroll');
        if (!(pane instanceof HTMLElement)) return null;
        return {
            top: Number(pane.scrollTop || 0),
            left: Number(pane.scrollLeft || 0),
        };
    }

    function __tmStageChecklistRenderRestore(snapshot) {
        const next = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!next) return null;
        state.pendingChecklistRenderRestore = {
            top: Number(next.top || 0),
            left: Number(next.left || 0),
        };
        try {
            state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
            state.viewScroll.list = {
                top: Number(state.pendingChecklistRenderRestore.top || 0),
                left: Number(state.pendingChecklistRenderRestore.left || 0),
            };
        } catch (e) {}
        return state.pendingChecklistRenderRestore;
    }

    function __tmRestoreChecklistRenderRestore(snapshot) {
        const next = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!next) return false;
        const restore = () => {
            try {
                const modal = state.modal instanceof Element ? state.modal : null;
                if (!(modal instanceof Element)) return;
                if (!(globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist'))) return;
                const pane = modal.querySelector('.tm-checklist-scroll');
                if (pane instanceof HTMLElement) {
                    pane.scrollTop = Number(next.top || 0);
                    pane.scrollLeft = Number(next.left || 0);
                    try { pane.__tmChecklistScrollUpdateThumb?.(); } catch (e2) {}
                }
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
        try { setTimeout(restore, 90); } catch (e) {}
        return true;
    }

    async function __tmLoadSelectedDocumentsPreserveChecklistScroll(options = {}) {
        const isChecklist = globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist');
        if (!isChecklist) return await loadSelectedDocuments(options);
        const modal = state.modal instanceof Element ? state.modal : null;
        const pane = modal?.querySelector?.('.tm-checklist-scroll');
        const top = Number(pane?.scrollTop || 0);
        const left = Number(pane?.scrollLeft || 0);
        const nextOptions = { ...(options && typeof options === 'object' ? options : {}), skipRender: true };
        await loadSelectedDocuments(nextOptions);
        try {
            if (!state.viewScroll || typeof state.viewScroll !== 'object') state.viewScroll = {};
            state.viewScroll.list = { top, left };
        } catch (e) {}
        __tmRenderChecklistPreserveScroll();
        const restore = () => {
            try {
                const nextPane = state.modal?.querySelector?.('.tm-checklist-scroll');
                if (!(nextPane instanceof HTMLElement)) return;
                nextPane.scrollTop = top;
                nextPane.scrollLeft = left;
                try { nextPane.__tmChecklistScrollUpdateThumb?.(); } catch (e2) {}
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
        try { setTimeout(restore, 90); } catch (e) {}
    }

    function __tmGetCalendarSidebarChecklistHost(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return null;
        const host = modal.querySelector?.('[data-tm-cal-role="task-page-list"]');
        return host instanceof HTMLElement ? host : null;
    }

    function __tmHasCalendarSidebarChecklist(modalEl) {
        if (!(globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar'))) return false;
        const host = __tmGetCalendarSidebarChecklistHost(modalEl);
        if (!(host instanceof HTMLElement)) return false;
        return !!host.querySelector?.('.tm-body.tm-body--checklist, .tm-checklist-scroll, .tm-checklist-layout');
    }

    function __tmIsChecklistSelectionContext(modalEl) {
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        const inChecklistSelectionView = globalThis.__tmRuntimeState?.isAnyViewMode?.(['checklist', 'whiteboard'])
            ?? (viewMode === 'checklist' || viewMode === 'whiteboard');
        if (inChecklistSelectionView) return true;
        return __tmHasCalendarSidebarChecklist(modalEl);
    }

    function __tmRefreshCalendarSidebarChecklistPreserveScroll() {
        const modal = state.modal instanceof Element ? state.modal : null;
        const pane = modal?.querySelector?.('[data-tm-cal-role="task-page-list"] .tm-checklist-scroll');
        const top = Number(pane?.scrollTop || 0);
        const left = Number(pane?.scrollLeft || 0);
        try { __tmPushRefreshDebug('calendar-sidebar-checklist-refresh', { top, left }); } catch (e) {}
        try {
            if (globalThis.__tmCalendar?.requestRefresh || globalThis.__tmCalendar?.refreshInPlace) {
                __tmRequestCalendarRefresh({
                    reason: 'calendar-sidebar-checklist-preserve-scroll',
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                    hard: false,
                }, { hard: false });
            }
            else render();
        } catch (e) {
            try { render(); } catch (e2) {}
        }
        const restore = () => {
            try {
                const nextPane = state.modal?.querySelector?.('[data-tm-cal-role="task-page-list"] .tm-checklist-scroll');
                if (!(nextPane instanceof HTMLElement)) return;
                nextPane.scrollTop = top;
                nextPane.scrollLeft = left;
                try { nextPane.__tmChecklistScrollUpdateThumb?.(); } catch (e2) {}
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
    }

    window.tmRenderCalendarSidebarChecklistHtml = function() {
        const renderBodyHtml = state.renderChecklistBodyHtml;
        if (typeof renderBodyHtml !== 'function') return '';
        const prevForce = !!state.__tmCalendarSidebarChecklistRender;
        state.__tmCalendarSidebarChecklistRender = true;
        try {
            return String(renderBodyHtml() || '');
        } catch (e) {
            return '';
        } finally {
            state.__tmCalendarSidebarChecklistRender = prevForce;
        }
    };

    window.tmAfterRenderCalendarSidebarChecklist = function() {
        const modal = state.modal instanceof Element ? state.modal : null;
        if (!(modal instanceof Element)) return false;
        if (!__tmHasCalendarSidebarChecklist(modal)) return false;
        try { __tmBindChecklistScrollVisibility(modal); } catch (e) {}
        try { __tmBindFloatingTooltips(modal); } catch (e) {}
        try { __tmRefreshChecklistSelectionInPlace(modal, 'calendar-sidebar-after-render'); } catch (e) {}
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        return true;
    };

    function __tmBindVerticalScrollVisibility(pane, track, thumb, options = {}) {
        if (!(pane instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const boundKey = String(opts.boundKey || '__tmVerticalScrollFxBound').trim() || '__tmVerticalScrollFxBound';
        if (pane[boundKey]) return true;
        pane[boundKey] = true;
        const visibleClass = String(opts.visibleClass || '').trim();
        const resizeObserverKey = String(opts.resizeObserverKey || '').trim();
        const resizeTargets = Array.isArray(opts.resizeTargets) ? opts.resizeTargets : [];
        const updateKey = String(opts.updateKey || '__tmVerticalScrollUpdateThumb').trim() || '__tmVerticalScrollUpdateThumb';
        const timerKey = String(opts.timerKey || '__tmVerticalScrollFxTimer').trim() || '__tmVerticalScrollFxTimer';
        const stateTimerKey = String(opts.stateTimerKey || '__tmVerticalScrollStateTimer').trim() || '__tmVerticalScrollStateTimer';
        const rafKey = String(opts.rafKey || '__tmVerticalScrollFxRaf').trim() || '__tmVerticalScrollFxRaf';
        const scrollClass = String(opts.scrollClass || 'tm-scroll-active').trim() || 'tm-scroll-active';
        const hideDelay = Math.max(120, Number(opts.hideDelay) || 600);
        const scrollStateDelay = Math.max(80, Number(opts.scrollStateDelay) || 160);
        const thumbMin = Math.max(16, Number(opts.thumbMin) || 24);
        let measured = false;
        let metrics = {
            viewport: 0,
            total: 0,
            trackSize: 0,
            maxScroll: 0,
            thumbSize: 0,
            maxTop: 0,
            visible: false,
        };
        const setVisible = (visible) => {
            if (!visibleClass) return;
            try { track.classList.toggle(visibleClass, !!visible); } catch (e) {}
        };
        const measure = () => {
            measured = true;
            const viewport = Number(pane.clientHeight || 0);
            const total = Number(pane.scrollHeight || 0);
            const trackSize = Number(track.clientHeight || 0);
            const visible = !!viewport && !!total && total > viewport + 1 && !!trackSize;
            if (!visible) {
                metrics = {
                    viewport,
                    total,
                    trackSize,
                    maxScroll: 0,
                    thumbSize: 0,
                    maxTop: 0,
                    visible: false,
                };
                try { thumb.style.height = '0px'; } catch (e) {}
                try { thumb.style.transform = 'translate3d(0, 0, 0)'; } catch (e) {}
                setVisible(false);
                return;
            }
            const ratio = Math.min(1, viewport / total);
            const thumbSize = Math.max(thumbMin, Math.round(trackSize * ratio));
            metrics = {
                viewport,
                total,
                trackSize,
                maxScroll: Math.max(1, total - viewport),
                thumbSize,
                maxTop: Math.max(0, trackSize - thumbSize),
                visible: true,
            };
            try { thumb.style.height = `${thumbSize}px`; } catch (e) {}
        };
        const paint = () => {
            if (!measured) measure();
            if (!metrics.visible) return;
            const progress = Math.min(1, Math.max(0, Number(pane.scrollTop || 0) / Math.max(1, metrics.maxScroll)));
            const top = Math.round(metrics.maxTop * progress);
            try { thumb.style.transform = `translate3d(0, ${top}px, 0)`; } catch (e) {}
        };
        const flush = (forceMeasure = false) => {
            if (forceMeasure || !measured) measure();
            paint();
        };
        const schedule = (forceMeasure = false) => {
            if (forceMeasure) pane.__tmVerticalScrollNeedsMeasure = true;
            if (pane[rafKey]) return;
            try {
                pane[rafKey] = requestAnimationFrame(() => {
                    const needMeasure = !!pane.__tmVerticalScrollNeedsMeasure;
                    pane.__tmVerticalScrollNeedsMeasure = false;
                    pane[rafKey] = 0;
                    flush(needMeasure);
                });
            } catch (e) {
                const needMeasure = !!pane.__tmVerticalScrollNeedsMeasure;
                pane.__tmVerticalScrollNeedsMeasure = false;
                pane[rafKey] = 0;
                flush(needMeasure);
            }
        };
        const markScrollActive = () => {
            try { pane.__tmLastUserScrollTs = Date.now(); } catch (e) {}
            try { pane.classList.add(scrollClass); } catch (e) {}
            try { clearTimeout(pane[stateTimerKey]); } catch (e) {}
            pane[stateTimerKey] = setTimeout(() => {
                pane[stateTimerKey] = 0;
                try { pane.classList.remove(scrollClass); } catch (e2) {}
            }, scrollStateDelay);
            if (state.viewRefreshPending || state.externalTaskTxDirty || __tmCalendarTxRefreshPending === true) {
                try { __tmScheduleDeferredRefreshAfterScroll('scroll-active'); } catch (e) {}
            }
        };
        const onScroll = () => {
            markScrollActive();
            try { opts.onScroll?.(pane); } catch (e) {}
            setVisible(true);
            try { clearTimeout(pane[timerKey]); } catch (e) {}
            pane[timerKey] = setTimeout(() => {
                pane[timerKey] = 0;
                setVisible(false);
            }, hideDelay);
            schedule(false);
        };
        pane.addEventListener('scroll', onScroll, { passive: true });
        pane[updateKey] = () => {
            schedule(true);
        };
        try {
            const ro = new ResizeObserver(() => schedule(true));
            ro.observe(pane);
            resizeTargets.forEach((target) => {
                if (target instanceof HTMLElement) ro.observe(target);
            });
            if (resizeObserverKey) pane[resizeObserverKey] = ro;
        } catch (e) {}
        schedule(true);
        return true;
    }

    function __tmBindChecklistScrollVisibility(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-checklist-scroll');
        const track = modal?.querySelector?.('.tm-checklist-scrollbar');
        const thumb = track?.querySelector?.('.tm-checklist-scrollbar-thumb');
        if (!(pane instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return;
        __tmBindVerticalScrollVisibility(pane, track, thumb, {
            boundKey: '__tmChecklistScrollFxBound',
            visibleClass: 'tm-checklist-scrollbar--visible',
            resizeObserverKey: '__tmChecklistScrollResizeObserver',
            resizeTargets: [pane.querySelector('.tm-checklist-items')],
            updateKey: '__tmChecklistScrollUpdateThumb',
            timerKey: '__tmChecklistScrollFxTimer',
            stateTimerKey: '__tmChecklistScrollStateTimer',
            rafKey: '__tmChecklistScrollFxRaf',
            scrollClass: 'tm-scroll-active',
        });
    }

    function __tmGetActiveMainViewScrollHost(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return null;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (viewMode === 'list') {
            const pane = modal.querySelector('.tm-body.tm-body--list');
            return pane instanceof HTMLElement ? pane : null;
        }
        if (viewMode === 'checklist') {
            const pane = modal.querySelector('.tm-checklist-scroll');
            return pane instanceof HTMLElement ? pane : null;
        }
        return null;
    }

    function __tmGetMainViewRefreshScrollQuietWindowMs() {
        return 2000;
    }

    function __tmShouldDeferMainViewRefreshForActiveScroll(detail = {}) {
        const next = (detail && typeof detail === 'object') ? detail : {};
        const mode = String(next.mode || 'current').trim() || 'current';
        if (mode === 'detail') return false;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (!(globalThis.__tmRuntimeState?.isAnyViewMode?.(['list', 'checklist'])
            ?? (viewMode === 'list' || viewMode === 'checklist'))) return false;
        const host = __tmGetActiveMainViewScrollHost(state.modal);
        if (!(host instanceof HTMLElement)) return false;
        if (state.listAutoLoadMoreInFlight) return true;
        if (host.classList?.contains?.('tm-scroll-active')) return true;
        const lastScrollTs = Number(host.__tmLastUserScrollTs || 0);
        const quietWindowMs = __tmGetMainViewRefreshScrollQuietWindowMs();
        return !!lastScrollTs && (Date.now() - lastScrollTs) < quietWindowMs;
    }

    function __tmGetDeferredMainViewRefreshDelay(detail = {}) {
        const next = (detail && typeof detail === 'object') ? detail : {};
        const mode = String(next.mode || 'current').trim() || 'current';
        if (mode === 'detail') return 140;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (!(globalThis.__tmRuntimeState?.isAnyViewMode?.(['list', 'checklist'])
            ?? (viewMode === 'list' || viewMode === 'checklist'))) return 140;
        const host = __tmGetActiveMainViewScrollHost(state.modal);
        if (!(host instanceof HTMLElement)) return 140;
        const now = Date.now();
        const lastScrollTs = Number(host.__tmLastUserScrollTs || 0);
        const quietWindowMs = __tmGetMainViewRefreshScrollQuietWindowMs();
        let waitMs = state.listAutoLoadMoreInFlight ? Math.max(quietWindowMs, 2200) : quietWindowMs;
        if (host.classList?.contains?.('tm-scroll-active')) {
            waitMs = Math.max(waitMs, quietWindowMs + 32);
        }
        if (lastScrollTs > 0) {
            waitMs = Math.max(waitMs, quietWindowMs - (now - lastScrollTs) + 32);
        }
        return Math.max(140, Math.min(2600, Math.round(waitMs)));
    }

    function __tmScheduleDeferredRefreshAfterScroll(reason = '') {
        const sourceLabel = String(reason || '').trim() || 'scroll-idle';
        const hasPendingWork = !!state.viewRefreshPending || !!state.externalTaskTxDirty || __tmCalendarTxRefreshPending === true;
        try {
            if (state.scrollDeferredRefreshTimer) clearTimeout(state.scrollDeferredRefreshTimer);
        } catch (e) {}
        state.scrollDeferredRefreshTimer = 0;
        if (!hasPendingWork) return false;
        const flushPending = () => {
            if (state.scrollDeferredRefreshTimer) state.scrollDeferredRefreshTimer = 0;
            if (state.viewRefreshPending && !state.viewRefreshTimer) {
                const pending = state.viewRefreshPending;
                state.viewRefreshPending = null;
                try { __tmScheduleViewRefresh(pending); } catch (e) {}
            }
            if (state.externalTaskTxDirty && !__tmTxTaskRefreshInFlight && !__tmTxTaskRefreshTimer) {
                __tmTxTaskRefreshTimer = setTimeout(() => {
                    __tmTxTaskRefreshTimer = null;
                    __tmFlushTaskIncrementalRefreshFromTx().catch(() => {});
                }, 24);
            }
            if (__tmCalendarTxRefreshPending === true && !__tmCalendarTxRefreshTimer) {
                try { __tmScheduleCalendarRefetchFromTx(); } catch (e) {}
            }
        };
        const host = __tmGetActiveMainViewScrollHost(state.modal);
        if (!(host instanceof HTMLElement)) {
            try { Promise.resolve().then(flushPending).catch(() => null); } catch (e) { flushPending(); }
            return true;
        }
        const waitMs = Math.max(140, __tmGetDeferredMainViewRefreshDelay({ mode: 'current', reason: sourceLabel }));
        state.scrollDeferredRefreshTimer = setTimeout(() => {
            state.scrollDeferredRefreshTimer = 0;
            if (__tmShouldDeferMainViewRefreshForActiveScroll({ mode: 'current', reason: sourceLabel })) {
                __tmScheduleDeferredRefreshAfterScroll(sourceLabel);
                return;
            }
            flushPending();
        }, waitMs);
        return true;
    }

    function __tmFlushDeferredViewRefreshAfterTaskFieldWork(reason = '') {
        const sourceLabel = String(reason || '').trim() || 'task-field-idle';
        const pending = state.viewRefreshPending;
        if (!pending) return false;
        if (__tmShouldDeferTaskFieldRefreshWork()) {
            try {
                __tmPushRefreshDebug('view-refresh-parked-task-work', {
                    reason: sourceLabel,
                    blocker: [
                        state.isRefreshing ? 'refresh-core' : '',
                        __tmTxTaskRefreshInFlight ? 'tx-refresh-in-flight' : '',
                        __tmTxTaskRefreshTimer ? 'tx-refresh-queued' : '',
                        __tmTabEnterAutoRefreshInFlight ? 'auto-refresh-in-flight' : '',
                    ].filter(Boolean).join(','),
                    pending,
                });
            } catch (e) {}
            return false;
        }
        if (state.viewRefreshTimer) return true;
        state.viewRefreshPending = null;
        try { __tmScheduleViewRefresh(pending); } catch (e) { state.viewRefreshPending = __tmMergeViewRefreshDetail(state.viewRefreshPending, pending); }
        return true;
    }

    function __tmMarkContextInteractionQuiet(reason = '', ttlMs = 0) {
        const holdMs = Math.max(240, Number(ttlMs) || 0);
        const until = Date.now() + holdMs;
        state.contextInteractionQuietUntil = Math.max(Number(state.contextInteractionQuietUntil) || 0, until);
        state.contextInteractionQuietReason = String(reason || '').trim() || 'context-switch';
        try {
            __tmPushRefreshDebug('context-interaction-quiet', {
                reason: String(state.contextInteractionQuietReason || '').trim(),
                holdMs,
                until: Number(state.contextInteractionQuietUntil || 0),
            });
        } catch (e) {}
        return Number(state.contextInteractionQuietUntil || 0);
    }

    function __tmGetEnterAutoRefreshDelayMeta(source = '') {
        const now = Date.now();
        const reasons = [];
        let waitMs = 0;
        const quietUntil = Number(state.contextInteractionQuietUntil || 0);
        if (quietUntil > now) {
            reasons.push(String(state.contextInteractionQuietReason || '').trim() || 'context-quiet');
            waitMs = Math.max(waitMs, quietUntil - now + 32);
        }
        if (__tmShouldDeferMainViewRefreshForActiveScroll({ mode: 'current', reason: source })) {
            reasons.push('scroll-active');
            waitMs = Math.max(waitMs, __tmGetDeferredMainViewRefreshDelay({ mode: 'current', reason: source }));
        }
        if (__tmTabEnterAutoRefreshInFlight) {
            reasons.push('auto-refresh-in-flight');
            waitMs = Math.max(waitMs, 180);
        }
        return {
            shouldDelay: reasons.length > 0,
            reason: reasons.join(','),
            waitMs: Math.max(120, Math.min(1800, Math.round(waitMs || 120))),
        };
    }

    function __tmGetBackgroundRefreshGateMeta(source = '', options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const sourceLabel = String(source || '').trim() || 'unknown';
        if (opts.requireVisible !== false && !__tmIsPluginVisibleNow()) {
            return {
                allowRun: false,
                parkUntilVisible: true,
                parkUntilScrollIdle: false,
                reason: 'plugin-hidden',
                waitMs: 0,
                source: sourceLabel,
            };
        }
        if (opts.ignoreContextQuiet === true) {
            return {
                allowRun: true,
                parkUntilVisible: false,
                parkUntilScrollIdle: false,
                reason: '',
                waitMs: 0,
                source: sourceLabel,
            };
        }
        const delayMeta = __tmGetEnterAutoRefreshDelayMeta(sourceLabel);
        if (delayMeta.shouldDelay) {
            const delayReason = String(delayMeta.reason || '').trim() || 'context-quiet';
            return {
                allowRun: false,
                parkUntilVisible: false,
                parkUntilScrollIdle: delayReason.includes('scroll-active'),
                reason: delayReason,
                waitMs: Math.max(120, Number(delayMeta.waitMs || 0) || 120),
                source: sourceLabel,
            };
        }
        return {
            allowRun: true,
            parkUntilVisible: false,
            parkUntilScrollIdle: false,
            reason: '',
            waitMs: 0,
            source: sourceLabel,
        };
    }

    function __tmGetListAutoLoadMoreState() {
        const total = Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0;
        const step = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
        const currentLimit = Math.max(step, Math.min(total, Number(state.listRenderLimit) || step));
        return {
            total,
            step,
            currentLimit,
            remaining: Math.max(0, total - currentLimit),
        };
    }

    function __tmGetListAutoLoadMoreBatchSize(meta = null) {
        const stateMeta = (meta && typeof meta === 'object') ? meta : __tmGetListAutoLoadMoreState();
        const step = Math.max(20, Number(stateMeta.step || 0) || 20);
        return Math.max(20, Math.min(step, 60));
    }

    function __tmScheduleListAutoLoadMoreHydration(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const mode = String(opts.mode || state.viewMode || '').trim();
        const sourceReason = String(opts.reason || 'list-auto-load-more-hydrate').trim() || 'list-auto-load-more-hydrate';
        if (mode !== 'list') return false;
        if (!Array.isArray(state.deferredListCustomFieldIds) || state.deferredListCustomFieldIds.length === 0) return false;
        state.listAutoLoadMoreHydrateToken = (Number(state.listAutoLoadMoreHydrateToken) || 0) + 1;
        const token = Number(state.listAutoLoadMoreHydrateToken) || 0;
        const arm = (delayMs = 240) => {
            try {
                if (state.listAutoLoadMoreHydrateTimer) clearTimeout(state.listAutoLoadMoreHydrateTimer);
            } catch (e) {}
            state.listAutoLoadMoreHydrateTimer = setTimeout(async () => {
                state.listAutoLoadMoreHydrateTimer = 0;
                if (token !== (Number(state.listAutoLoadMoreHydrateToken) || 0)) return;
                if (__tmShouldDeferTaskFieldRefreshWork()) {
                    arm(180);
                    return;
                }
                if (__tmShouldDeferMainViewRefreshForActiveScroll({ mode: 'current', reason: sourceReason })) {
                    arm(Math.max(320, __tmGetDeferredMainViewRefreshDelay({ mode: 'current', reason: sourceReason })));
                    return;
                }
                let hydrateMeta = null;
                try {
                    const hydrateOptions = {
                        limit: Number(state.listRenderLimit) || 0,
                    };
                    if (Array.isArray(opts.customFieldDefs) && opts.customFieldDefs.length > 0) {
                        hydrateOptions.customFieldDefs = opts.customFieldDefs;
                    }
                    hydrateMeta = await __tmHydrateVisibleListCustomFields(state.deferredListCustomFieldIds, hydrateOptions);
                } catch (e) {
                    hydrateMeta = null;
                }
                if (token !== (Number(state.listAutoLoadMoreHydrateToken) || 0)) return;
                const changed = Number(hydrateMeta?.cacheMissCount || 0) > 0
                    || Number(hydrateMeta?.hostAssignedCount || 0) > 0
                    || Number(hydrateMeta?.selfAssignedCount || 0) > 0;
                if (!changed) return;
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: false,
                        reason: sourceReason,
                    });
                } catch (e) {}
            }, Math.max(120, Number(delayMs || 0) || 120));
        };
        arm(Number(opts.delayMs) || 240);
        return true;
    }

    function __tmScheduleDeferredVisibleListCustomFieldHydration(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        return __tmScheduleListAutoLoadMoreHydration({
            ...opts,
            mode: String(opts.mode || state.viewMode || '').trim() || 'list',
        });
    }

    async function __tmAutoLoadMoreVisibleRows(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const mode = String(opts.mode || state.viewMode || '').trim();
        if (mode !== 'list' && mode !== 'checklist') return false;
        if (state.listAutoLoadMoreInFlight) return false;
        const now = Date.now();
        if ((now - Number(state.listAutoLoadMoreLastTs || 0)) < 120) return false;
        const meta = __tmGetListAutoLoadMoreState();
        if (meta.remaining <= 0) return false;
        state.listAutoLoadMoreInFlight = true;
        state.listAutoLoadMoreLastTs = now;
        try {
            const growBy = __tmGetListAutoLoadMoreBatchSize(meta);
            state.listRenderLimit = Math.min(meta.total, meta.currentLimit + growBy);
            try {
                __tmPushRefreshDebug('list-auto-load-more', {
                    mode,
                    source: String(opts.source || '').trim() || 'scroll-near-bottom',
                    prevLimit: meta.currentLimit,
                    nextLimit: Number(state.listRenderLimit) || 0,
                    total: meta.total,
                    growBy,
                });
            } catch (e) {}
            if (mode === 'checklist') {
                __tmRenderChecklistPreserveScroll();
            } else if (!__tmRerenderListInPlace(state.modal)) {
                render();
            }
            try {
                __tmScheduleListAutoLoadMoreHydration({
                    mode,
                    delayMs: 240,
                    reason: 'list-auto-load-more-hydrate',
                });
            } catch (e) {}
            return true;
        } finally {
            state.listAutoLoadMoreInFlight = false;
        }
    }

    function __tmBindAutoLoadMoreOnScroll(modalEl, modeHint = '') {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const mode = String(modeHint || state.viewMode || '').trim();
        if (mode !== 'list' && mode !== 'checklist') return;
        const pane = mode === 'checklist'
            ? modal.querySelector('.tm-checklist-scroll')
            : modal.querySelector('.tm-body.tm-body--list');
        if (!(pane instanceof HTMLElement) || pane.__tmAutoLoadMoreScrollBound) return;
        const onScroll = () => {
            const meta = __tmGetListAutoLoadMoreState();
            if (meta.remaining <= 0) return;
            const viewport = Math.max(0, Number(pane.clientHeight || 0));
            const maxScrollTop = Math.max(0, Number(pane.scrollHeight || 0) - viewport);
            if (maxScrollTop <= 0) return;
            const remainingPx = Math.max(0, maxScrollTop - (Number(pane.scrollTop || 0)));
            const thresholdPx = Math.max(96, Math.min(320, Math.round(viewport * 0.35) || 0));
            if (remainingPx > thresholdPx) return;
            __tmAutoLoadMoreVisibleRows({
                mode,
                source: 'scroll-near-bottom',
            }).catch(() => null);
        };
        pane.addEventListener('scroll', onScroll, { passive: true });
        pane.__tmAutoLoadMoreScrollBound = true;
        pane.__tmAutoLoadMoreScrollHandler = onScroll;
        try { requestAnimationFrame(onScroll); } catch (e) {}
    }

    function __tmBindListScrollVisibility(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-body.tm-body--list');
        const track = modal?.querySelector?.('.tm-table-scrollbar');
        const thumb = track?.querySelector?.('.tm-table-scrollbar-thumb');
        if (!(pane instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return;
        __tmBindVerticalScrollVisibility(pane, track, thumb, {
            boundKey: '__tmTableScrollFxBound',
            visibleClass: 'tm-table-scrollbar--visible',
            resizeObserverKey: '__tmTableScrollResizeObserver',
            resizeTargets: [pane.querySelector('#tmTaskTable')],
            updateKey: '__tmTableScrollUpdateThumb',
            timerKey: '__tmTableScrollFxTimer',
            stateTimerKey: '__tmTableScrollStateTimer',
            rafKey: '__tmTableScrollFxRaf',
            scrollClass: 'tm-scroll-active',
            onScroll: () => {
                try {
                    if (!state.viewScroll || typeof state.viewScroll !== 'object') state.viewScroll = {};
                    state.viewScroll.list = {
                        top: Number(pane.scrollTop || 0),
                        left: Number(pane.scrollLeft || 0),
                    };
                } catch (e) {}
            },
        });
    }

    function __tmBindDocTabWheelScroll(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-doc-tabs-scroll');
        __tmBindHorizontalWheelScroll(pane, {
            boundKey: '__tmDocTabWheelBound',
            handlerKey: '__tmDocTabWheelHandler',
        });
    }

    function __tmBindBottomViewbarWheelScroll(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-mobile-bottom-viewbar__inner');
        __tmBindHorizontalWheelScroll(pane, {
            boundKey: '__tmBottomViewbarWheelBound',
            handlerKey: '__tmBottomViewbarWheelHandler',
            onAfterScroll: (event) => {
                try { if (typeof window.tmTouchMobileBottomViewbar === 'function') window.tmTouchMobileBottomViewbar(event); } catch (e) {}
            },
        });
    }

    function __tmBindHorizontalWheelScroll(scroller, options = {}) {
        if (!(scroller instanceof HTMLElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const boundKey = String(opts.boundKey || '__tmHorizontalWheelBound').trim() || '__tmHorizontalWheelBound';
        const handlerKey = String(opts.handlerKey || '__tmHorizontalWheelHandler').trim() || '__tmHorizontalWheelHandler';
        if (scroller[boundKey]) return;
        const onWheel = (event) => {
            if (!(event instanceof WheelEvent) || event.ctrlKey) return;
            const maxLeft = Math.max(0, (Number(scroller.scrollWidth) || 0) - (Number(scroller.clientWidth) || 0));
            if (maxLeft <= 1) return;
            const deltaX = Number(event.deltaX) || 0;
            const deltaY = Number(event.deltaY) || 0;
            const primaryDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
            if (!primaryDelta) return;
            const prevLeft = Number(scroller.scrollLeft) || 0;
            const nextLeft = Math.max(0, Math.min(maxLeft, prevLeft + primaryDelta));
            if (Math.abs(nextLeft - prevLeft) < 0.5) return;
            scroller.scrollLeft = nextLeft;
            if (typeof opts.onAfterScroll === 'function') {
                try { opts.onAfterScroll(event, { prevLeft, nextLeft, scroller }); } catch (e) {}
            }
            event.preventDefault();
        };
        scroller.addEventListener('wheel', onWheel, { passive: false });
        scroller[boundKey] = true;
        scroller[handlerKey] = onWheel;
    }

    function __tmBindDocTabScrollMemory(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-doc-tabs-scroll');
        if (!(pane instanceof HTMLElement)) return;
        const sync = () => {
            try { state.docTabsScrollLeft = Number(pane.scrollLeft) || 0; } catch (e) {}
        };
        if (!pane.__tmDocTabScrollBound) {
            pane.addEventListener('scroll', sync, { passive: true });
            pane.__tmDocTabScrollBound = true;
            pane.__tmDocTabScrollHandler = sync;
        }
        sync();
    }

    function __tmRestoreDocTabScroll(modalEl, left) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const pane = modal?.querySelector?.('.tm-doc-tabs-scroll');
        if (!(pane instanceof HTMLElement)) return;
        const desiredLeft = Math.max(0, Number(left) || 0);
        const apply = () => {
            try {
                const maxLeft = Math.max(0, (Number(pane.scrollWidth) || 0) - (Number(pane.clientWidth) || 0));
                const nextLeft = Math.min(desiredLeft, maxLeft);
                pane.scrollLeft = nextLeft;
                state.docTabsScrollLeft = nextLeft;
            } catch (e) {}
        };
        apply();
        try { requestAnimationFrame(apply); } catch (e) {}
        try { requestAnimationFrame(() => requestAnimationFrame(apply)); } catch (e) {}
        try { setTimeout(apply, 0); } catch (e) {}
    }

    function __tmApplyPopupOpenAnimation(rootEl, surfaceEl, options = {}) {
        const root = rootEl instanceof Element ? rootEl : null;
        const surface = surfaceEl instanceof Element ? surfaceEl : null;
        if (!root || !surface) return;
        try {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        } catch (e) {}
        const opts = (options && typeof options === 'object') ? options : {};
        const mode = String(opts.mode || 'center').trim();
        try { root.classList.add('tm-popup-overlay-enter'); } catch (e) {}
        try {
            surface.classList.add(mode === 'sheet' ? 'tm-popup-surface-enter--sheet' : 'tm-popup-surface-enter');
        } catch (e) {}
    }

    function showPrompt(title, placeholder = '', defaultValue = '') {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            const box = document.createElement('div');
            box.className = 'tm-prompt-box';

            const titleEl = document.createElement('div');
            titleEl.className = 'tm-prompt-title';
            titleEl.textContent = String(title ?? '');

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tm-prompt-input';
            input.placeholder = String(placeholder ?? '');
            input.value = String(defaultValue ?? '');
            try { input.autofocus = true; } catch (e) {}

            const buttons = document.createElement('div');
            buttons.className = 'tm-prompt-buttons';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tm-prompt-btn tm-prompt-btn-secondary';
            cancelBtn.id = 'tm-prompt-cancel';
            cancelBtn.textContent = '取消';

            const okBtn = document.createElement('button');
            okBtn.className = 'tm-prompt-btn tm-prompt-btn-primary';
            okBtn.id = 'tm-prompt-ok';
            okBtn.textContent = '确定';

            buttons.appendChild(cancelBtn);
            buttons.appendChild(okBtn);
            box.appendChild(titleEl);
            box.appendChild(input);
            box.appendChild(buttons);
            modal.appendChild(box);
            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, box);

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            const focusInput = () => {
                try {
                    input.focus({ preventScroll: true });
                } catch (e) {
                    try { input.focus(); } catch (e2) {}
                }
                try { input.select?.(); } catch (e) {}
            };
            focusInput();
            try { requestAnimationFrame(() => focusInput()); } catch (e) {}
            setTimeout(() => focusInput(), 30);

            okBtn.onclick = () => {
                const value = String(input.value || '').trim();
                removeFromStack();
                modal.remove();
                resolve(value);
            };

            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(null);
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cancelBtn.click();
                }
            };
        });
    }

    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${esc(String(title || '确认'))}</div>
                    <div style="padding: 10px 0; color: var(--tm-text-color); font-size: 14px; line-height: 1.5;">
                        ${esc(String(message || ''))}
                    </div>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-confirm-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-confirm-ok">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));

            const okBtn = modal.querySelector('#tm-confirm-ok');
            const cancelBtn = modal.querySelector('#tm-confirm-cancel');

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            okBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(true);
            };
            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(false);
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function showDurationPrompt(title, defaultValue) {
        const initialValue = __tmNormalizeDurationPresetValue(defaultValue);
        const presets = __tmGetDurationPresetOptions();
        if (!presets.length) {
            return showPrompt(title, '例如：30 或 30m', initialValue);
        }
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';
            modal.innerHTML = `
                <div class="tm-prompt-box tm-prompt-box--duration" style="width:auto;max-width:min(92vw,220px);">
                    <div class="tm-prompt-title">${esc(String(title || '设置时长').trim() || '设置时长')}</div>
                    <div class="tm-duration-preset-list" style="margin-bottom:10px;">
                        ${__tmBuildDurationPresetOptionsHtml(initialValue, presets)}
                    </div>
                    <div class="tm-duration-preset-helper" style="margin-bottom:8px;">可选预设，也可直接填写自定义时长</div>
                    <input class="tm-prompt-input tm-duration-editor-input" data-tm-duration-prompt-input type="text" value="${esc(initialValue)}" placeholder="例如：30 或 30m">
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-duration-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-duration-clear">清空</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-duration-ok">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));
            const input = modal.querySelector('[data-tm-duration-prompt-input]');
            const okBtn = modal.querySelector('#tm-duration-ok');
            const clearBtn = modal.querySelector('#tm-duration-clear');
            const cancelBtn = modal.querySelector('#tm-duration-cancel');
            if (!(input instanceof HTMLInputElement) || !(okBtn instanceof HTMLButtonElement) || !(clearBtn instanceof HTMLButtonElement) || !(cancelBtn instanceof HTMLButtonElement)) {
                modal.remove();
                resolve(null);
                return;
            }
            __tmBindDurationPresetSelection(modal, input);

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());
            const commit = (value) => {
                removeFromStack();
                modal.remove();
                resolve(__tmNormalizeDurationPresetValue(value));
            };
            const focusInput = () => {
                try {
                    input.focus({ preventScroll: true });
                } catch (e) {
                    try { input.focus(); } catch (e2) {}
                }
                try { input.select?.(); } catch (e) {}
            };
            focusInput();
            try { requestAnimationFrame(() => focusInput()); } catch (e) {}
            setTimeout(() => focusInput(), 30);

            okBtn.onclick = () => commit(input.value);
            clearBtn.onclick = () => commit('');
            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(null);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') {
                    cancelBtn.click();
                    return;
                }
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function showTaskRepeatRuleDialog(taskLike, options = {}) {
        return new Promise((resolve) => {
            document.querySelector('.tm-repeat-modal')?.remove?.();
            const opts = (options && typeof options === 'object') ? options : {};
            const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
            const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule || task?.repeat_rule || '', {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            });
            const anchorDate = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || currentRule.anchorDate || new Date());
            const modal = document.createElement('div');
            modal.className = 'tm-repeat-modal';
            modal.innerHTML = `
                <div class="tm-repeat-card">
                    <div class="tm-repeat-title">${esc(String(opts.title || '循环设置').trim() || '循环设置')}</div>
                    <div class="tm-repeat-stack">
                        <div class="tm-repeat-field">
                            <div class="tm-repeat-label">触发方式</div>
                            <select class="tm-repeat-select" data-tm-repeat-field="triggerType">
                                <option value="none"${(!currentRule.enabled || currentRule.type === 'none') ? ' selected' : ''}>不循环</option>
                                <option value="due"${(currentRule.enabled && currentRule.trigger === 'due') ? ' selected' : ''}>到期重复</option>
                                <option value="complete"${(currentRule.enabled && currentRule.trigger === 'complete') ? ' selected' : ''}>完成重复</option>
                            </select>
                        </div>
                        <div class="tm-repeat-field">
                            <div class="tm-repeat-label">循环频率</div>
                            <div class="tm-repeat-inline">
                                <div class="tm-repeat-inline-prefix">每</div>
                                <input class="tm-repeat-input" data-tm-repeat-field="every" type="number" min="1" max="3650" step="1" value="${esc(String(currentRule.every || 1))}">
                                <select class="tm-repeat-select" data-tm-repeat-field="type">
                                    <option value="daily"${currentRule.type === 'daily' ? ' selected' : ''}>天</option>
                                    <option value="workday"${currentRule.type === 'workday' ? ' selected' : ''}>工作日</option>
                                    <option value="weekly"${currentRule.type === 'weekly' ? ' selected' : ''}>周</option>
                                    <option value="monthly"${currentRule.type === 'monthly' ? ' selected' : ''}>月</option>
                                    <option value="yearly"${currentRule.type === 'yearly' ? ' selected' : ''}>年</option>
                                </select>
                            </div>
                        </div>
                        <div class="tm-repeat-field" data-tm-repeat-monthly-wrap style="display:${currentRule.type === 'monthly' ? 'flex' : 'none'};flex-direction:column;gap:8px;">
                            <div class="tm-repeat-label">每月规则</div>
                            <div class="tm-repeat-segments">
                                <button type="button" class="tm-repeat-segment ${currentRule.monthlyMode !== 'weekday' ? 'is-active' : ''}" data-tm-repeat-monthly="date">${esc(__tmGetTaskRepeatMonthlyModeCaption('date', anchorDate))}</button>
                                <button type="button" class="tm-repeat-segment ${currentRule.monthlyMode === 'weekday' ? 'is-active' : ''}" data-tm-repeat-monthly="weekday">${esc(__tmGetTaskRepeatMonthlyModeCaption('weekday', anchorDate))}</button>
                            </div>
                        </div>
                        <div class="tm-repeat-field">
                            <div class="tm-repeat-label">循环截止</div>
                            <input class="tm-repeat-input" data-tm-repeat-field="until" type="date" value="${esc(String(currentRule.until || '').trim())}">
                            <div class="tm-repeat-muted">基准日期：${esc(anchorDate || '未设置')}</div>
                        </div>
                        <div class="tm-repeat-summary" data-tm-repeat-summary></div>
                        <div class="tm-repeat-actions">
                            <button type="button" class="tm-repeat-action tm-repeat-action--primary" data-tm-repeat-action="confirm">确定</button>
                            <button type="button" class="tm-repeat-action tm-repeat-action--ghost" data-tm-repeat-action="cancel">取消</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const card = modal.querySelector('.tm-repeat-card');
            __tmApplyPopupOpenAnimation(modal, card);
            const triggerTypeEl = modal.querySelector('[data-tm-repeat-field="triggerType"]');
            const everyEl = modal.querySelector('[data-tm-repeat-field="every"]');
            const typeEl = modal.querySelector('[data-tm-repeat-field="type"]');
            const untilEl = modal.querySelector('[data-tm-repeat-field="until"]');
            const monthlyWrap = modal.querySelector('[data-tm-repeat-monthly-wrap]');
            const summaryEl = modal.querySelector('[data-tm-repeat-summary]');
            const confirmBtn = modal.querySelector('[data-tm-repeat-action="confirm"]');
            const cancelBtn = modal.querySelector('[data-tm-repeat-action="cancel"]');
            const monthlyButtons = Array.from(modal.querySelectorAll('[data-tm-repeat-monthly]')).filter((el) => el instanceof HTMLButtonElement);
            let monthlyMode = currentRule.monthlyMode || 'date';
            let settled = false;

            const removeFromStack = __tmModalStackBind(() => cancelBtn?.click?.());
            const finish = (value) => {
                if (settled) return;
                settled = true;
                removeFromStack();
                try { modal.remove(); } catch (e) {}
                resolve(value);
            };
            const readDraft = () => {
                const triggerType = String(triggerTypeEl?.value || 'none').trim();
                const type = __tmNormalizeTaskRepeatType(typeEl?.value || currentRule.type || 'daily');
                const every = __tmNormalizeTaskRepeatEvery(everyEl?.value || currentRule.every || 1, type);
                const until = __tmNormalizeTaskRepeatUntil(untilEl?.value || '');
                if (triggerType === 'none') {
                    return __tmNormalizeTaskRepeatRule({ enabled: false, type: 'none' }, {
                        anchorDate,
                        startDate: task?.startDate,
                        completionTime: task?.completionTime,
                    });
                }
                return __tmNormalizeTaskRepeatRule({
                    enabled: true,
                    trigger: triggerType,
                    type,
                    every,
                    monthlyMode,
                    until,
                    anchorDate,
                }, {
                    anchorDate,
                    startDate: task?.startDate,
                    completionTime: task?.completionTime,
                });
            };
            const syncMonthlyButtons = () => {
                monthlyButtons.forEach((btn) => {
                    const value = String(btn.getAttribute('data-tm-repeat-monthly') || '').trim();
                    btn.classList.toggle('is-active', value === monthlyMode);
                });
            };
            const syncUi = () => {
                const triggerType = String(triggerTypeEl?.value || 'none').trim();
                const type = __tmNormalizeTaskRepeatType(typeEl?.value || currentRule.type || 'daily');
                const disabled = triggerType === 'none';
                if (everyEl instanceof HTMLInputElement) everyEl.disabled = disabled;
                if (typeEl instanceof HTMLSelectElement) typeEl.disabled = disabled;
                if (untilEl instanceof HTMLInputElement) untilEl.disabled = disabled;
                if (monthlyWrap instanceof HTMLElement) monthlyWrap.style.display = (!disabled && type === 'monthly') ? 'flex' : 'none';
                syncMonthlyButtons();
                const draft = readDraft();
                if (summaryEl instanceof HTMLElement) {
                    summaryEl.textContent = draft.enabled
                        ? `${__tmGetTaskRepeatSummary(draft, { startDate: task?.startDate, completionTime: task?.completionTime })}。`
                        : '当前任务不会自动循环。';
                }
            };

            monthlyButtons.forEach((btn) => {
                btn.onclick = () => {
                    monthlyMode = String(btn.getAttribute('data-tm-repeat-monthly') || '').trim() === 'weekday' ? 'weekday' : 'date';
                    syncUi();
                };
            });
            triggerTypeEl?.addEventListener('change', syncUi);
            typeEl?.addEventListener('change', syncUi);
            everyEl?.addEventListener('input', syncUi);
            untilEl?.addEventListener('change', syncUi);
            confirmBtn?.addEventListener('click', () => finish(readDraft()));
            cancelBtn?.addEventListener('click', () => finish(null));
            modal.addEventListener('click', (ev) => {
                if (ev.target === modal) finish(null);
            });
            try {
                everyEl?.focus?.({ preventScroll: true });
            } catch (e) {
                try { everyEl?.focus?.(); } catch (e2) {}
            }
            syncUi();
        });
    }

    function showSelectPrompt(title, options, defaultValue) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            const opts = Array.isArray(options) ? options : [];
            const items = opts.map(opt => {
                const value = typeof opt === 'string' ? opt : String(opt?.value || '');
                const label = typeof opt === 'string' ? opt : String(opt?.label || opt?.value || '');
                const selected = value === String(defaultValue ?? '') ? 'selected' : '';
                return `<option value="${esc(value)}" ${selected}>${esc(label)}</option>`;
            }).join('');

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <select class="tm-prompt-input tm-prompt-select">
                        ${items}
                    </select>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                        <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));
            const select = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            okBtn.onclick = () => {
                const value = String(select.value || '').trim();
                removeFromStack();
                modal.remove();
                resolve(value);
            };
            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(null);
            };
            select.onkeydown = (e) => {
                if (e.key === 'Enter') okBtn.click();
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function __tmOpenDocSearchPrompt(title, docs, options = {}) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';
            const normalizedDocs = (Array.isArray(docs) ? docs : [])
                .map((doc) => {
                    const id = String(doc?.id || '').trim();
                    if (!id) return null;
                    const rawName = String(doc?.name || '').trim() || __tmGetDocRawName(id, '') || id || '未命名文档';
                    const displayName = __tmGetDocDisplayName({ ...doc, name: rawName }, rawName) || rawName;
                    const alias = __tmGetDocAliasValue({ ...doc, name: rawName });
                    const path = String(doc?.path || '').trim();
                    return {
                        ...doc,
                        id,
                        name: rawName,
                        displayName,
                        alias,
                        path,
                        searchText: [displayName, rawName, alias, id, path].join('\n').toLowerCase(),
                    };
                })
                .filter(Boolean);
            const placeholder = String(options?.placeholder || '').trim() || '输入文档名、别名或 ID';
            const emptyText = String(options?.emptyText || '').trim() || '没有匹配的文档';
            const limit = Math.max(20, Math.min(200, Math.round(Number(options?.limit) || 80)));

            modal.innerHTML = `
                <div class="tm-prompt-box" style="width:min(92vw,560px);max-height:78vh;display:flex;flex-direction:column;">
                    <div class="tm-prompt-title">${esc(String(title || '搜索文档'))}</div>
                    <input class="tm-prompt-input" data-tm-doc-search-input placeholder="${esc(placeholder)}" autocomplete="off">
                    <div data-tm-doc-search-count style="margin-top:8px;font-size:12px;color:var(--tm-secondary-text);"></div>
                    <div data-tm-doc-search-list style="margin-top:10px;max-height:min(52vh,420px);overflow:auto;"></div>
                    <div class="tm-prompt-buttons">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-doc-search-cancel">取消</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));

            const input = modal.querySelector('[data-tm-doc-search-input]');
            const countEl = modal.querySelector('[data-tm-doc-search-count]');
            const listEl = modal.querySelector('[data-tm-doc-search-list]');
            const cancelBtn = modal.querySelector('#tm-doc-search-cancel');

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());
            let currentMatches = normalizedDocs.slice();

            const finish = (value) => {
                removeFromStack();
                modal.remove();
                resolve(value || null);
            };

            const renderList = () => {
                const keyword = String(input?.value || '').trim().toLowerCase();
                currentMatches = keyword
                    ? normalizedDocs.filter((doc) => doc.searchText.includes(keyword))
                    : normalizedDocs.slice();

                if (countEl instanceof HTMLElement) {
                    countEl.textContent = keyword
                        ? `找到 ${currentMatches.length} 个文档`
                        : `当前分组共 ${normalizedDocs.length} 个文档`;
                }
                if (!(listEl instanceof HTMLElement)) return;
                listEl.innerHTML = '';

                if (!currentMatches.length) {
                    listEl.innerHTML = `<div style="padding:12px 4px;color:var(--tm-secondary-text);font-size:13px;">${esc(emptyText)}</div>`;
                    return;
                }

                currentMatches.slice(0, limit).forEach((doc) => {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'tm-btn tm-btn-secondary';
                    row.style.cssText = 'display:block;width:100%;padding:10px 12px;margin-bottom:6px;text-align:left;justify-content:flex-start;';
                    const metaParts = [];
                    if (doc.alias && doc.alias !== doc.displayName && doc.alias !== doc.name) metaParts.push(`别名：${doc.alias}`);
                    metaParts.push(doc.id);
                    row.innerHTML = `
                        <div style="min-width:0;">
                            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(doc.displayName || doc.name || '未命名文档')}</div>
                            <div style="margin-top:3px;font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(metaParts.join(' · '))}</div>
                        </div>
                    `;
                    row.onclick = () => finish(doc.id);
                    listEl.appendChild(row);
                });

                if (currentMatches.length > limit) {
                    const more = document.createElement('div');
                    more.style.cssText = 'padding:6px 4px 0;color:var(--tm-secondary-text);font-size:12px;';
                    more.textContent = `结果较多，仅显示前 ${limit} 个，请继续输入以缩小范围`;
                    listEl.appendChild(more);
                }
            };

            cancelBtn.onclick = () => finish(null);
            if (input instanceof HTMLInputElement) {
                input.oninput = () => renderList();
                input.onkeydown = (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        finish(null);
                        return;
                    }
                    if (e.key === 'Enter' && !e.isComposing) {
                        e.preventDefault();
                        const first = currentMatches[0];
                        if (first?.id) finish(first.id);
                    }
                };
                try {
                    requestAnimationFrame(() => {
                        try { input.focus(); } catch (e) {}
                    });
                } catch (e) {}
            }
            modal.onclick = (e) => {
                if (e.target === modal) finish(null);
            };

            renderList();
        });
    }

    function showChoiceButtonsPrompt(title, choices) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            const items = Array.isArray(choices) ? choices : [];
            modal.innerHTML = `
                <div class="tm-prompt-box" style="width:min(92vw,520px);">
                    <div class="tm-prompt-title">${esc(String(title || '请选择'))}</div>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;padding:8px 0 2px;">
                        ${items.map((item, idx) => `
                            <button class="tm-btn ${idx === 0 ? 'tm-btn-primary' : 'tm-btn-info'}" data-tm-choice-value="${esc(String(item?.value || ''))}" style="flex:1;min-width:180px;padding:14px 12px;font-size:15px;font-weight:600;">
                                ${esc(String(item?.label || item?.value || ''))}
                            </button>
                        `).join('')}
                    </div>
                    <div class="tm-prompt-buttons" style="margin-top:14px;">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-choice-cancel">取消</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));
            const cancelBtn = modal.querySelector('#tm-choice-cancel');
            const choiceButtons = Array.from(modal.querySelectorAll('[data-tm-choice-value]'));

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            choiceButtons.forEach((btn) => {
                btn.onclick = () => {
                    const value = String(btn.getAttribute('data-tm-choice-value') || '').trim();
                    removeFromStack();
                    modal.remove();
                    resolve(value || null);
                };
            });

            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(null);
            };

            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function __tmNormalizeDocIdsForGroupInput(input) {
        const source = Array.isArray(input) ? input : [input];
        const seen = new Set();
        return source.map((item) => String(item || '').trim()).filter((id) => {
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    function __tmTryCollectDocIdsFromElements(elements) {
        const out = [];
        const push = (raw) => {
            const id = String(raw || '').trim();
            if (id) out.push(id);
        };
        try {
            Array.from(elements || []).forEach((el) => {
                if (!el) return;
                push(el.dataset?.nodeId);
                push(el.dataset?.id);
                push(el.getAttribute?.('data-node-id'));
                push(el.getAttribute?.('data-id'));
            });
        } catch (e) {}
        return __tmNormalizeDocIdsForGroupInput(out);
    }

    function __tmGetDocIdFromProtyle(protyle) {
        try {
            const direct = [
                protyle?.querySelector?.('.protyle-title')?.getAttribute?.('data-node-id'),
                protyle?.querySelector?.('.protyle-title__input')?.getAttribute?.('data-node-id'),
                protyle?.querySelector?.('.protyle-background')?.getAttribute?.('data-node-id'),
                protyle?.dataset?.nodeId,
                protyle?.dataset?.id
            ];
            return direct.map((v) => String(v || '').trim()).find(Boolean) || '';
        } catch (e) {
            return '';
        }
    }

    function __tmResolveAnyBlockIdFromElement(element) {
        try {
            const el = (element instanceof Element) ? element : null;
            const owner = el?.closest?.('[data-node-id], [data-id]') || el;
            if (!owner) return '';
            return String(
                owner.getAttribute?.('data-node-id')
                || owner.getAttribute?.('data-id')
                || owner.dataset?.nodeId
                || owner.dataset?.id
                || ''
            ).trim();
        } catch (e) {
            return '';
        }
    }

    function __tmCollectBlockIdsFromElements(elements) {
        const out = [];
        const seen = new Set();
        try {
            const list = elements instanceof Element
                ? [elements]
                : Array.from(elements || []);
            list.forEach((item) => {
                const id = __tmResolveAnyBlockIdFromElement(item);
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(id);
            });
        } catch (e) {}
        return out;
    }

    function __tmResolveCollectableOtherBlockIdFromElement(element) {
        try {
            const el = element?.closest?.('[data-node-id]') || element;
            if (!el) return '';
            const nodeId = __tmResolveAnyBlockIdFromElement(el);
            if (!nodeId) return '';
            const dataType = String(el?.dataset?.type || '').trim();
            const subtype = String(
                el?.dataset?.subtype
                || el?.getAttribute?.('data-subtype')
                || el?.closest?.('[data-subtype]')?.getAttribute?.('data-subtype')
                || ''
            ).trim().toLowerCase();
            const isHeading = !!(el?.matches?.('.h1, .h2, .h3, .h4, .h5, .h6') || dataType.includes('Heading'));
            const isParagraph = !!(el?.classList?.contains?.('p') || dataType === 'NodeParagraph');
            const isList = !!(el?.classList?.contains?.('list') || dataType === 'NodeList');
            const isListItem = !!(el?.classList?.contains?.('li') || dataType === 'NodeListItem');
            if (isHeading || isParagraph) return nodeId;
            if ((isList || isListItem) && (subtype === 'o' || subtype === 'u')) return nodeId;
            return '';
        } catch (e) {
            return '';
        }
    }

    function __tmCollectOtherBlockIdsFromElements(elements) {
        const out = [];
        const seen = new Set();
        try {
            const list = elements instanceof Element
                ? [elements]
                : Array.from(elements || []);
            list.forEach((item) => {
                const id = __tmResolveCollectableOtherBlockIdFromElement(item);
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(id);
            });
        } catch (e) {}
        return out;
    }

    function __tmRememberTitleMenuContext(target) {
        try {
            if (!target || !target.closest) return;
            if (target.closest('#commonMenu') || target.closest('.b3-menu')) return;
            const protyle = target.closest('.protyle');
            if (!protyle) return;
            const isTitle = !!(target.closest('.protyle-title') || target.closest('.protyle-title__input') || target.closest('.protyle-icon'));
            if (!isTitle) return;
            __tmLastRightClickedTitleProtyle = protyle;
            __tmLastRightClickedTitleAtMs = Date.now();
        } catch (e) {}
    }

    function __tmFindContextBlockElement(target) {
        try {
            const node = (target instanceof Element) ? target : target?.parentElement || null;
            if (!node || !node.closest) return null;
            if (node.closest('#commonMenu') || node.closest('.b3-menu')) return null;
            if (node.closest('.protyle-title, .protyle-title__input, .protyle-icon, .protyle-background')) return null;
            const blockEl = node.closest('[data-node-id], [data-id]');
            if (!(blockEl instanceof Element)) return null;
            if (!blockEl.closest('.protyle')) return null;
            if (!blockEl.closest('.protyle-wysiwyg, .protyle-content, .protyle-gutters')) return null;
            const blockId = __tmResolveAnyBlockIdFromElement(blockEl);
            if (!blockId) return null;
            return blockEl;
        } catch (e) {
            return null;
        }
    }

    function __tmRememberBlockMenuContext(target, event0) {
        try {
            const type = String(event0?.type || '').trim();
            const button = Number(event0?.button);
            if (type !== 'contextmenu' && button !== 2) return;
            const blockEl = __tmFindContextBlockElement(target);
            if (!blockEl) return;
            const blockId = __tmResolveAnyBlockIdFromElement(blockEl);
            if (!blockId) return;
            __tmLastRightClickedBlockEl = blockEl;
            __tmLastRightClickedBlockId = blockId;
            __tmLastRightClickedBlockAtMs = Date.now();
        } catch (e) {}
    }

    function __tmGetRecentBlockMenuContext() {
        const blockId = String(__tmLastRightClickedBlockId || '').trim();
        const atMs = Number(__tmLastRightClickedBlockAtMs) || 0;
        if (!blockId || !atMs || (Date.now() - atMs) > 3000) return null;
        const blockElement = (__tmLastRightClickedBlockEl && __tmLastRightClickedBlockEl.isConnected)
            ? __tmLastRightClickedBlockEl
            : null;
        return { blockId, blockElement };
    }

    function __tmResolveProtyleElement(protyleLike) {
        const candidates = [
            protyleLike,
            protyleLike?.element,
            protyleLike?.protyle?.element,
            protyleLike?.wysiwyg?.element,
            protyleLike?.protyle?.wysiwyg?.element,
        ];
        for (const candidate of candidates) {
            if (!(candidate instanceof Element)) continue;
            if (candidate.matches?.('.protyle')) return candidate;
            const protyle = candidate.closest?.('.protyle');
            if (protyle) return protyle;
        }
        return null;
    }

    function __tmCollectSelectedBlockIdsFromProtyle(protyleLike, fallbackBlockId = '') {
        const out = [];
        const seen = new Set();
        const push = (element) => {
            const owner = (element?.matches?.('[data-node-id], [data-id]') ? element : element?.closest?.('[data-node-id], [data-id]')) || null;
            const id = __tmResolveAnyBlockIdFromElement(owner);
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        };
        const protyle = __tmResolveProtyleElement(protyleLike);
        const root = protyle?.querySelector?.('.protyle-wysiwyg, .protyle-content') || protyle;
        try {
            Array.from(root?.querySelectorAll?.('.protyle-wysiwyg--select, .protyle-content--select') || []).forEach(push);
        } catch (e) {}
        const fallbackId = String(fallbackBlockId || '').trim();
        if (!out.length && fallbackId && !seen.has(fallbackId)) out.push(fallbackId);
        return out;
    }

    async function __tmGetBlocksByIdsPreserveOrder(ids) {
        const list = Array.from(new Set((ids || []).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!list.length) return [];
        const rows = await API.getBlocksByIds(list).catch(() => []);
        const rowMap = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.id || '').trim(), row]));
        return list.map((id) => rowMap.get(id)).filter(Boolean);
    }

    async function __tmFindDirectChildAnchorExcluding(docId, mode = 'first', excludeIds = []) {
        const did = String(docId || '').trim();
        if (!did) return '';
        const excluded = new Set((excludeIds || []).map((item) => String(item || '').trim()).filter(Boolean));
        const children = await API.getChildBlocks(did);
        const filtered = children.filter((child) => {
            const childId = String(child?.id || '').trim();
            return childId && !excluded.has(childId);
        });
        if (!filtered.length) return '';
        const target = String(mode || '').trim() === 'last' ? filtered[filtered.length - 1] : filtered[0];
        return String(target?.id || '').trim();
    }

    async function __tmResolveDailyNoteNotebookIdForBlocks(blockIds, options = {}) {
        let notebookId = __tmResolveConfiguredDailyNoteNotebookId();
        if (notebookId) return notebookId;
        let sourceDocId = '';
        try {
            const rows = await __tmGetBlocksByIdsPreserveOrder(blockIds);
            sourceDocId = String(rows[0]?.root_id || '').trim();
        } catch (e) {}
        if (!sourceDocId) {
            const protyle = __tmResolveProtyleElement(options?.protyle || null);
            sourceDocId = __tmGetDocIdFromProtyle(protyle);
        }
        if (sourceDocId) {
            try { notebookId = await API.getDocNotebook(sourceDocId); } catch (e) {}
        }
        return String(notebookId || '').trim();
    }

    async function __tmMoveBlocksToDailyNote(blockIds, options = {}) {
        const normalizedIds = Array.from(new Set((blockIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!normalizedIds.length) throw new Error('未找到可移动的块');

        const rows = await __tmGetBlocksByIdsPreserveOrder(normalizedIds);
        const movableRows = rows.filter((row) => String(row?.type || '').trim().toLowerCase() !== 'd');
        const movableIds = movableRows.map((row) => String(row?.id || '').trim()).filter(Boolean);
        if (!movableIds.length) throw new Error('当前仅支持移动块内容，不支持移动整篇文档');

        const notebookId = await __tmResolveDailyNoteNotebookIdForBlocks(movableIds, options);
        if (!notebookId) throw new Error('无法确定日记所属笔记本');
        const targetDocId = await API.createDailyNote(notebookId);
        const appendToBottom = SettingsStore.data.newTaskDailyNoteAppendToBottom === true;
        const targetTopListId = String(await API.getFirstDirectChildListIdOfDoc(targetDocId).catch(() => '') || '').trim();
        const sourceDocIds = new Set([String(targetDocId || '').trim()]);
        movableRows.forEach((row) => {
            const rootId = String(row?.root_id || '').trim();
            if (rootId) sourceDocIds.add(rootId);
        });

        const isTaskRow = (row) => String(row?.type || '').trim().toLowerCase() === 'i' && String(row?.subtype || '').trim().toLowerCase() === 't';
        const moveRowToParent = async (row, targetParentId, anchors) => {
            const blockId = String(row?.id || '').trim();
            const parentId = String(targetParentId || '').trim();
            if (!blockId || !parentId) throw new Error('移动失败：缺少目标容器');
            if (appendToBottom) {
                if (anchors.previousID) await API.moveBlock(blockId, { previousID: anchors.previousID, parentID: parentId });
                else await API.moveBlock(blockId, { parentID: parentId });
                anchors.previousID = blockId;
                return;
            }
            if (anchors.nextID) {
                await API.moveBlock(blockId, { nextID: anchors.nextID, parentID: parentId });
                return;
            }
            if (anchors.previousID) await API.moveBlock(blockId, { previousID: anchors.previousID, parentID: parentId });
            else await API.moveBlock(blockId, { parentID: parentId });
            anchors.previousID = blockId;
        };

        const docAnchors = appendToBottom
            ? {
                previousID: String(await __tmFindDirectChildAnchorExcluding(targetDocId, 'last', movableIds).catch(() => '') || '').trim(),
                nextID: ''
            }
            : {
                previousID: '',
                nextID: String(await __tmFindDirectChildAnchorExcluding(targetDocId, 'first', movableIds).catch(() => '') || '').trim()
            };
        const taskAnchors = targetTopListId
            ? (appendToBottom
                ? {
                    previousID: String(await __tmFindDirectChildAnchorExcluding(targetTopListId, 'last', movableIds).catch(() => '') || '').trim(),
                    nextID: ''
                }
                : {
                    previousID: '',
                    nextID: String(await __tmFindDirectChildAnchorExcluding(targetTopListId, 'first', movableIds).catch(() => '') || '').trim()
                })
            : null;

        for (const row of movableRows) {
            if (isTaskRow(row) && targetTopListId) {
                await moveRowToParent(row, targetTopListId, taskAnchors);
            } else {
                await moveRowToParent(row, targetDocId, docAnchors);
            }
        }

        try {
            sourceDocIds.forEach((docId) => {
                if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            });
        } catch (e) {
            try { __tmInvalidateAllSqlCaches(); } catch (e2) {}
        }
        try { __tmLoadSelectedDocumentsPreserveChecklistScroll().catch(() => {}); } catch (e) {}
        try {
            if (__tmIsPluginVisibleNow()) __tmRefreshMainViewInPlace({ withFilters: true });
        } catch (e) {}
        try { globalThis.__tmCalendar?.refreshInPlace?.({ hard: false }); } catch (e) {}

        return {
            targetDocId: String(targetDocId || '').trim(),
            movedCount: movableIds.length,
        };
    }

    function __tmAddMoveBlockToDailyNoteMenuItem(menu, blockIds, options = {}) {
        if (!menu || typeof menu.addItem !== 'function') return;
        if (SettingsStore.data.enableMoveBlockToDailyNote !== true) return;
        const normalizedIds = Array.from(new Set((blockIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!normalizedIds.length) return;
        menu.addItem({
            icon: 'iconTaskHorizon',
            label: normalizedIds.length > 1 ? '移动所选内容至今天日记' : '移动内容至今天日记',
            click: async () => {
                try {
                    const result = await __tmMoveBlocksToDailyNote(normalizedIds, options);
                    hint(
                        result.movedCount > 1
                            ? `✅ 已移动 ${result.movedCount} 个块到今天日记`
                            : '✅ 已移动到今天日记',
                        'success'
                    );
                } catch (e) {
                    hint(`❌ 移动失败: ${e.message}`, 'error');
                }
            }
        });
    }

    function __tmShiftDateKeyByDays(value, deltaDays = 1) {
        const key = __tmNormalizeDateOnly(value);
        if (!key) return '';
        const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return '';
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
        if (Number.isNaN(dt.getTime())) return '';
        dt.setDate(dt.getDate() + Math.round(Number(deltaDays) || 0));
        const pad = (n) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }

    function __tmNormalizeScheduleDraftTitle(value, fallback = '') {
        let text = String(value || fallback || '').trim();
        if (!text) return '';
        try {
            const firstLine = (typeof API?.extractTaskContentLine === 'function')
                ? API.extractTaskContentLine(text)
                : text.split(/\r?\n/)[0];
            text = String(firstLine || text).trim();
        } catch (e) {}
        try { text = __tmNormalizeHeadingText(text); } catch (e) {}
        try {
            if (typeof API?.normalizeTaskContent === 'function') {
                text = String(API.normalizeTaskContent(text) || text).trim();
            }
        } catch (e) {}
        text = text.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (text.length > 80) text = `${text.slice(0, 77).trim()}...`;
        return text;
    }

    function __tmBuildTaskDateDraftFromTaskLike(taskLike) {
        const s0 = __tmNormalizeDateOnly(taskLike?.startDate || '');
        const e0 = __tmNormalizeDateOnly(taskLike?.completionTime || '');
        if (!s0 && !e0) {
            return {
                taskDateStartKey: '',
                taskDateEndExclusiveKey: '',
            };
        }
        const milestoneRaw = taskLike?.milestone;
        const isMilestone = typeof milestoneRaw === 'boolean'
            ? milestoneRaw
            : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
        const hasBothDates = !!s0 && !!e0;
        const startKey = (isMilestone && hasBothDates) ? e0 : (s0 || e0);
        const endKey = e0 || s0 || startKey;
        return {
            taskDateStartKey: startKey,
            taskDateEndExclusiveKey: __tmShiftDateKeyByDays(endKey, 1),
        };
    }

    async function __tmResolveScheduleDraftForBlock(blockId, blockElement, extra = {}) {
        const rawId = String(blockId || '').trim();
        if (!rawId) return null;
        const ext = (extra && typeof extra === 'object') ? extra : {};
        let taskId = '';
        try { taskId = await __tmResolveTaskIdFromAnyBlockId(rawId); } catch (e) {}

        let task = null;
        if (taskId) {
            task = globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks?.[taskId] || null;
            if (!task) {
                try { task = await __tmEnsureTaskInStateById(taskId); } catch (e) { task = null; }
            }
            if (!task) {
                try { task = await __tmBuildTaskLikeFromBlockId(taskId); } catch (e) { task = null; }
            }
        }

        let blockLike = null;
        try { blockLike = await __tmBuildTaskLikeFromBlockId(rawId); } catch (e) { blockLike = null; }

        let blockRow = null;
        try {
            const rows = await API.getOtherBlocksByIds([rawId]);
            blockRow = Array.isArray(rows) && rows.length ? rows[0] : null;
        } catch (e) {
            blockRow = null;
        }

        const explicitTitle = __tmNormalizeScheduleDraftTitle(ext.title || '');
        const taskTitle = __tmNormalizeScheduleDraftTitle(task?.content || task?.raw_content || task?.markdown || '');
        const blockTitle = __tmNormalizeScheduleDraftTitle(
            blockRow?.content
            || blockLike?.content
            || blockElement?.textContent
            || ''
        );
        const dateDraft = (() => {
            const explicitStartKey = __tmNormalizeDateOnly(ext.taskDateStartKey || ext.startKey || '');
            const explicitEndExKey = __tmNormalizeDateOnly(ext.taskDateEndExclusiveKey || ext.endExclusiveKey || '');
            if (explicitStartKey && explicitEndExKey) {
                return {
                    taskDateStartKey: explicitStartKey,
                    taskDateEndExclusiveKey: explicitEndExKey,
                };
            }
            if (taskId) return __tmBuildTaskDateDraftFromTaskLike(task || blockLike || {});
            return __tmBuildTaskDateDraftFromTaskLike(blockLike || {});
        })();

        return {
            id: String(ext.id || ext.scheduleId || '').trim(),
            blockId: rawId,
            taskId: String(taskId || '').trim(),
            title: explicitTitle || taskTitle || blockTitle || '日程',
            taskStartDate: __tmNormalizeDateOnly((task || blockLike || {})?.startDate || ''),
            taskCompletionTime: __tmNormalizeDateOnly((task || blockLike || {})?.completionTime || ''),
            taskDateStartKey: String(dateDraft.taskDateStartKey || '').trim(),
            taskDateEndExclusiveKey: String(dateDraft.taskDateEndExclusiveKey || '').trim(),
            calendarId: String(ext.calendarId || '').trim(),
            start: ext.start || null,
            end: ext.end || null,
            allDay: ext.allDay === true,
        };
    }

    async function __tmOpenScheduleEditorForBlock(blockId, blockElement, extra = {}) {
        const calendarApi = globalThis.__tmCalendar;
        if (!calendarApi) {
            hint('⚠ 日历模块尚未加载完成', 'warning');
            return false;
        }
        const draft = await __tmResolveScheduleDraftForBlock(blockId, blockElement, extra);
        if (!draft) {
            hint('⚠ 未找到可编辑的块', 'warning');
            return false;
        }
        if (typeof calendarApi.openScheduleEditor === 'function') {
            try {
                return !!(await calendarApi.openScheduleEditor(draft));
            } catch (e) {
                hint(`❌ ${String(e?.message || e || '打开日程编辑器失败')}`, 'error');
                return false;
            }
        }
        if (draft.taskId && typeof calendarApi.openScheduleEditorByTaskId === 'function') {
            try {
                return !!(await calendarApi.openScheduleEditorByTaskId(draft.taskId, draft));
            } catch (e) {
                hint(`❌ ${String(e?.message || e || '打开日程编辑器失败')}`, 'error');
                return false;
            }
        }
        hint('⚠ 当前日历模块不支持从块打开日程编辑', 'warning');
        return false;
    }

    function __tmCreateNativeMenuItem(label, onClick, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = ['b3-menu__item', 'tm-doc-group-menu-item', String(extraClass || '').trim()].filter(Boolean).join(' ');
        btn.type = 'button';
        btn.innerHTML = `
            <svg class="b3-menu__icon"><use xlink:href="#iconTaskHorizon"></use></svg>
            <span class="b3-menu__label">${esc(String(label || '添加到任务管理器分组'))}</span>
        `;
        btn.onclick = async (e) => {
            try { e.preventDefault(); } catch (e2) {}
            try { e.stopPropagation(); } catch (e2) {}
            try { globalThis.__tmCompat?.closeGlobalMenu?.(); } catch (e2) {}
            try { await onClick?.(); } catch (e2) {}
        };
        return btn;
    }

    function __tmInsertMenuItem(menuItems, menuItem) {
        if (!menuItems || !menuItem) return;
        const ref = menuItems.querySelector('button[data-id="addToDatabase"]');
        const existing = menuItems.querySelector('.tm-doc-group-menu-item');
        Array.from(menuItems.querySelectorAll('.tm-doc-group-menu-separator')).forEach((el) => {
            try { el.remove(); } catch (e) {}
        });
        if (existing) existing.remove();
        if (ref && ref.parentNode === menuItems) {
            const divider = document.createElement('button');
            divider.className = 'b3-menu__separator tm-doc-group-menu-separator';
            ref.before(divider);
            ref.before(menuItem);
            return;
        }
        menuItems.appendChild(menuItem);
    }

    function __tmToDatetimeLocalValue(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function __tmParseDatetimeLocalToISO(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) === false && /^\d{4}-\d{2}-\d{2}$/.test(s) === false) {
            const d0 = new Date(s);
            if (!Number.isNaN(d0.getTime())) return d0.toISOString();
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const m0 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const y0 = Number(m0[1]);
            const mon0 = Number(m0[2]) - 1;
            const d0 = Number(m0[3]);
            const dt0 = new Date(y0, mon0, d0, 0, 0, 0, 0);
            if (Number.isNaN(dt0.getTime())) return '';
            return dt0.toISOString();
        }
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (!m) return '';
        const y = Number(m[1]);
        const mon = Number(m[2]) - 1;
        const d = Number(m[3]);
        const hh = Number(m[4]);
        const mm = Number(m[5]);
        const ss = Number(m[6] || 0);
        const dt = new Date(y, mon, d, hh, mm, ss, 0);
        if (Number.isNaN(dt.getTime())) return '';
        return dt.toISOString();
    }

    function showDateTimePrompt(title, defaultIso) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <input type="datetime-local" class="tm-prompt-input" value="${esc(__tmToDatetimeLocalValue(defaultIso))}" autofocus>
                    <div class="tm-prompt-buttons" style="justify-content: space-between;">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-clear">清空</button>
                        <div style="display:flex;gap:10px;">
                            <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                            <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));
            const input = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');
            const clearBtn = modal.querySelector('#tm-prompt-clear');

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            okBtn.onclick = () => {
                const raw = String(input.value || '').trim();
                removeFromStack();
                modal.remove();
                if (!raw) return resolve('');
                resolve(__tmParseDatetimeLocalToISO(raw));
            };
            clearBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve('');
            };
            cancelBtn.onclick = () => {
                removeFromStack();
                modal.remove();
                resolve(null);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') okBtn.click();
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
        });
    }

    function showDatePrompt(title, defaultDate) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.tm-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal';

            const d0 = String(defaultDate || '').trim().slice(0, 10);
            modal.innerHTML = `
                <div class="tm-prompt-box">
                    <div class="tm-prompt-title">${title}</div>
                    <input type="date" class="tm-prompt-input" value="${esc(d0)}" autofocus>
                    <div class="tm-prompt-buttons" style="justify-content: space-between;">
                        <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-clear">清空</button>
                        <div style="display:flex;gap:10px;">
                            <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-prompt-cancel">取消</button>
                            <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-prompt-ok">确定</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'));
            const input = modal.querySelector('.tm-prompt-input');
            const okBtn = modal.querySelector('#tm-prompt-ok');
            const cancelBtn = modal.querySelector('#tm-prompt-cancel');
            const clearBtn = modal.querySelector('#tm-prompt-clear');

            const removeFromStack = __tmModalStackBind(() => cancelBtn.click());

            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                removeFromStack();
                try { modal.remove(); } catch (e) {}
                resolve(value);
            };

            okBtn.onclick = () => {
                const raw = String(input.value || '').trim();
                finish(raw ? __tmNormalizeDateOnly(raw) : '');
            };
            clearBtn.onclick = () => {
                finish('');
            };
            cancelBtn.onclick = () => {
                finish(null);
            };
            input.onclick = () => { try { input.showPicker?.(); } catch (e) {} };
            if (__tmIsMobileDevice()) {
                input.onchange = () => {
                    const raw = String(input.value || '').trim();
                    if (!raw) return;
                    setTimeout(() => finish(__tmNormalizeDateOnly(raw)), 0);
                };
            }
            input.onkeydown = (e) => {
                if (e.key === 'Enter') okBtn.click();
            };
            modal.onclick = (e) => {
                if (e.target === modal) cancelBtn.click();
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
        });
    }

    function __tmGetMultiSelectTargetIds() {
        return __tmGetMultiSelectedTaskIds().filter((id) => !!(globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id]));
    }

    function __tmBuildBatchResultHint(result, actionLabel) {
        const ok = Number(result?.successCount) || 0;
        const fail = Number(result?.failureCount) || 0;
        const label = String(actionLabel || '批量更新').trim() || '批量更新';
        if (ok > 0 && fail <= 0) return `✅ ${label}成功（${ok} 项）`;
        if (ok > 0 && fail > 0) return `⚠ ${label}完成：成功 ${ok} 项，失败 ${fail} 项`;
        return `❌ ${label}失败`;
    }

    async function __tmApplyBatchAttrPatch(patch, options = {}) {
        const targetIds = __tmGetMultiSelectTargetIds();
        if (!targetIds.length) {
            hint('⚠ 请先选择至少一条任务', 'warning');
            return { successCount: 0, failureCount: 0, failures: [] };
        }
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!Object.keys(nextPatch).length) {
            hint('⚠ 未找到可批量更新的内容', 'warning');
            return { successCount: 0, failureCount: 0, failures: [] };
        }
        const result = await __tmMutationEngine.requestTaskPatchBatch(targetIds, nextPatch, {
            source: String(options?.source || 'batch-attr').trim() || 'batch-attr',
            label: String(options?.actionLabel || '批量更新').trim() || '批量更新',
            reason: String(options?.source || 'batch-attr').trim() || 'batch-attr',
        });
        const failureCount = Number(result?.failureCount) || 0;
        const actionLabel = String(options.actionLabel || '批量更新').trim() || '批量更新';
        hint(__tmBuildBatchResultHint(result, actionLabel), (Number(result?.successCount) > 0 && failureCount <= 0) ? 'success' : (Number(result?.successCount) > 0 ? 'warning' : 'error'));
        return result;
    }

    function __tmBuildBatchCustomFieldPromptText(field) {
        const options = Array.isArray(field?.options) ? field.options : [];
        const names = options.map((item) => String(item?.name || item?.id || '').trim()).filter(Boolean);
        return names.length
            ? `可用选项：${names.join('、')}；多个值请用逗号分隔，留空清空`
            : '多个值请用逗号分隔，留空清空';
    }

    async function __tmBatchSetStartDate() {
        state.multiBulkEditFieldKey = 'startDate';
        try {
            const next = await showDatePrompt('批量设置开始日期', '');
            if (next === null) return;
            await __tmApplyBatchAttrPatch({ startDate: String(next || '').trim() }, {
                actionLabel: String(next || '').trim() ? '批量设置开始日期' : '批量清空开始日期'
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetCompletionDate() {
        state.multiBulkEditFieldKey = 'completionTime';
        try {
            const next = await showDatePrompt('批量设置截止日期', '');
            if (next === null) return;
            await __tmApplyBatchAttrPatch({ completionTime: String(next || '').trim() }, {
                actionLabel: String(next || '').trim() ? '批量设置截止日期' : '批量清空截止日期'
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetPriority() {
        state.multiBulkEditFieldKey = 'priority';
        try {
            const next = await showSelectPrompt('批量设置重要性', [
                { value: 'none', label: '无' },
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
            ], 'none');
            if (next === null) return;
            await __tmApplyBatchAttrPatch({ priority: String(next || 'none').trim() || 'none' }, {
                actionLabel: '批量设置重要性'
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetStatus() {
        state.multiBulkEditFieldKey = 'customStatus';
        try {
            const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
            const options = statusOptions
                .map((item) => ({
                    value: String(item?.id || '').trim(),
                    label: String(item?.name || item?.id || '').trim() || String(item?.id || '').trim(),
                }))
                .filter((item) => item.value);
            if (!options.length) {
                hint('⚠ 请先在设置中配置状态选项', 'warning');
                return;
            }
            const next = await showSelectPrompt('批量设置状态', options, __tmGetDefaultUndoneStatusId(statusOptions));
            if (next === null) return;
            const targetIds = __tmGetMultiSelectTargetIds();
            const result = await __tmMutationEngine.requestTaskPatchBatch(targetIds, { customStatus: String(next || '').trim() }, {
                source: 'multi-status',
                label: '状态',
                reason: 'multi-status',
            });
            hint(__tmBuildBatchResultHint(result, '批量设置状态'), (result.successCount > 0 && result.failureCount <= 0) ? 'success' : (result.successCount > 0 ? 'warning' : 'error'));
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetStartDateTime() {
        state.multiBulkEditFieldKey = 'startDateTime';
        try {
            const next = await showDateTimePrompt('批量设置开始时间', '');
            if (next === null) return;
            await __tmApplyBatchAttrPatch({ startDate: String(next || '').trim() }, {
                actionLabel: String(next || '').trim() ? '批量设置开始时间' : '批量清空开始时间'
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetCompletionDateTime() {
        state.multiBulkEditFieldKey = 'completionDateTime';
        try {
            const next = await showDateTimePrompt('批量设置截止日期', '');
            if (next === null) return;
            await __tmApplyBatchAttrPatch({ completionTime: String(next || '').trim() }, {
                actionLabel: String(next || '').trim() ? '批量设置截止日期' : '批量清空截止日期'
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    async function __tmBatchSetPinned(pinned) {
        await __tmApplyBatchAttrPatch({ pinned: pinned ? '1' : '' }, {
            actionLabel: pinned ? '批量置顶' : '批量取消置顶'
        });
    }

    async function __tmBatchSetDone(done) {
        const targetIds = __tmGetMultiSelectTargetIds();
        if (!targetIds.length) {
            hint('⚠ 请先选择至少一条任务', 'warning');
            return { successCount: 0, failureCount: 0, failures: [] };
        }
        const targetDone = !!done;
        const result = await __tmMutationEngine.requestTaskPatchBatch(targetIds, { done: targetDone }, {
            source: 'multi-done',
            label: targetDone ? '批量完成' : '批量取消完成',
            reason: 'multi-done',
            suppressHint: true,
        });
        try { __tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: false }); } catch (e) {}
        const actionLabel = targetDone ? '批量完成' : '批量取消完成';
        hint(__tmBuildBatchResultHint(result, actionLabel), (result.successCount > 0 && result.failureCount <= 0) ? 'success' : (result.successCount > 0 ? 'warning' : 'error'));
        return result;
    }

    async function __tmBatchSetDoneStatus() {
        const statusId = __tmResolveCheckboxLinkedStatusId(true);
        if (!statusId) {
            hint('⚠ 请先在设置中配置完成状态联动', 'warning');
            return;
        }
        await __tmApplyBatchAttrPatch({ customStatus: statusId }, {
            actionLabel: '批量设置完成状态'
        });
    }

    async function __tmBatchSetCustomField() {
        state.multiBulkEditFieldKey = 'customField';
        try {
            const fieldDefs = __tmGetCustomFieldDefs()
                .filter((field) => Array.isArray(field?.options) && field.options.length > 0);
            const fieldOptions = fieldDefs
                .map((field) => ({
                    value: String(field?.id || '').trim(),
                    label: `${String(field?.name || field?.id || '').trim() || '未命名字段'}（${String(field?.type || '').trim() === 'multi' ? '多选' : '单选'}）`,
                }))
                .filter((item) => item.value);
            if (!fieldOptions.length) {
                hint('⚠ 当前没有可批量设置的自定义选项列', 'warning');
                return;
            }
            const fieldId = await showSelectPrompt('选择自定义列', fieldOptions, fieldOptions[0]?.value || '');
            if (fieldId === null) return;
            const field = fieldDefs.find((item) => String(item?.id || '').trim() === String(fieldId || '').trim()) || null;
            if (!field) {
                hint('⚠ 未找到对应自定义列', 'warning');
                return;
            }
            let normalizedValue;
            if (String(field?.type || '').trim() === 'multi') {
                const raw = await showPrompt(`批量设置 ${String(field?.name || fieldId).trim()}`, __tmBuildBatchCustomFieldPromptText(field), '');
                if (raw === null) return;
                normalizedValue = __tmNormalizeCustomFieldValue(field, raw);
            } else {
                const options = [
                    { value: '', label: '清空' },
                    ...((Array.isArray(field?.options) ? field.options : []).map((item) => ({
                        value: String(item?.id || '').trim(),
                        label: String(item?.name || item?.id || '').trim() || String(item?.id || '').trim(),
                    })).filter((item) => item.value))
                ];
                const raw = await showSelectPrompt(`批量设置 ${String(field?.name || fieldId).trim()}`, options, '');
                if (raw === null) return;
                normalizedValue = __tmNormalizeCustomFieldValue(field, raw);
            }
            await __tmApplyBatchAttrPatch({ customFieldValues: { [String(fieldId || '').trim()]: normalizedValue } }, {
                actionLabel: `批量设置 ${String(field?.name || fieldId).trim()}`
            });
        } finally {
            state.multiBulkEditFieldKey = '';
        }
    }

    window.tmMultiSelectClear = function() {
        __tmClearMultiTaskSelection({ keepMode: true });
    };

    window.tmMultiSelectExit = function() {
        window.tmToggleMultiSelectMode(false);
    };

    window.tmMultiSelectBatchSetStartDate = async function() {
        await __tmBatchSetStartDate();
    };

    window.tmMultiSelectBatchSetCompletionDate = async function() {
        await __tmBatchSetCompletionDate();
    };

    window.tmMultiSelectBatchSetPriority = async function() {
        await __tmBatchSetPriority();
    };

    window.tmMultiSelectBatchSetStatus = async function() {
        await __tmBatchSetStatus();
    };

    window.tmMultiSelectBatchSetStartDateTime = async function() {
        await __tmBatchSetStartDateTime();
    };

    window.tmMultiSelectBatchSetCompletionDateTime = async function() {
        await __tmBatchSetCompletionDateTime();
    };

    window.tmMultiSelectBatchPin = async function() {
        await __tmBatchSetPinned(true);
    };

    window.tmMultiSelectBatchUnpin = async function() {
        await __tmBatchSetPinned(false);
    };

    window.tmMultiSelectBatchComplete = async function() {
        await __tmBatchSetDone(true);
    };

    window.tmMultiSelectBatchUncomplete = async function() {
        await __tmBatchSetDone(false);
    };

    window.tmMultiSelectBatchSetDoneStatus = async function() {
        await __tmBatchSetDoneStatus();
    };

    window.tmMultiSelectBatchSetCustomField = async function() {
        await __tmBatchSetCustomField();
    };

    function __tmCloseMultiSelectMoreMenu() {
        try {
            if (state.multiSelectMenuCloseHandler) {
                __tmClearOutsideCloseHandler(state.multiSelectMenuCloseHandler);
            }
        } catch (e) {}
        try { state.multiSelectMenuEl?.remove?.(); } catch (e) {}
        state.multiSelectMenuEl = null;
        state.multiSelectMenuAnchorEl = null;
        state.multiSelectMenuCloseHandler = null;
    }

    function __tmBuildMultiSelectMenuItem(label, iconName, onClick, options = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-multi-bulkbar__menu-item';
        if (options.disabled) btn.disabled = true;
        btn.innerHTML = `<span class="tm-multi-bulkbar__menu-icon">${__tmPhosphorBoldSvg(iconName, { size: 14, className: 'tm-multi-bulkbar__menu-icon-svg' })}</span><span>${esc(String(label || '').trim())}</span>`;
        btn.onclick = async (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            if (btn.disabled) return;
            __tmCloseMultiSelectMoreMenu();
            try { await onClick?.(); } catch (e) {}
        };
        return btn;
    }

    function __tmOpenMultiSelectMoreMenu(anchorEl) {
        const anchor = anchorEl instanceof Element ? anchorEl : null;
        if (!(anchor instanceof Element)) return;
        const selectedCount = __tmGetMultiSelectTargetIds().length;
        if (selectedCount <= 0) return;
        __tmCloseMultiSelectMoreMenu();

        const menu = document.createElement('div');
        menu.className = 'tm-popup-menu bc-dropdown-menu tm-multi-bulkbar__menu';
        menu.appendChild(__tmBuildMultiSelectMenuItem('完成', 'check-circle-2', () => window.tmMultiSelectBatchComplete?.()));
        menu.appendChild(__tmBuildMultiSelectMenuItem('取消完成', 'circle-dot', () => window.tmMultiSelectBatchUncomplete?.()));
        {
            const separator = document.createElement('div');
            separator.className = 'tm-multi-bulkbar__menu-separator';
            menu.appendChild(separator);
        }
        menu.appendChild(__tmBuildMultiSelectMenuItem('置顶', 'pin', () => window.tmMultiSelectBatchPin?.()));
        menu.appendChild(__tmBuildMultiSelectMenuItem('取消置顶', 'x-circle', () => window.tmMultiSelectBatchUnpin?.()));
        {
            const separator = document.createElement('div');
            separator.className = 'tm-multi-bulkbar__menu-separator';
            menu.appendChild(separator);
        }
        menu.appendChild(__tmBuildMultiSelectMenuItem('自定义列', 'chart-column', () => window.tmMultiSelectBatchSetCustomField?.()));

        document.body.appendChild(menu);
        const rect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        let left = Math.round(rect.right - menuRect.width);
        let top = Math.round(rect.top - menuRect.height - 8);
        if (top < 8) top = Math.round(rect.bottom + 8);
        try { menu.style.left = `${Math.max(8, left)}px`; } catch (e) {}
        try { menu.style.top = `${Math.max(8, top)}px`; } catch (e) {}
        try { __tmClampFloatingMenuToViewport(menu, left, top, { margin: 8 }); } catch (e) {}

        const closeHandler = (ev) => {
            const target = ev?.target instanceof Element ? ev.target : null;
            if (target?.closest?.('.tm-multi-bulkbar__menu')) return;
            if (target?.closest?.('[data-tm-multi-more-btn]')) return;
            __tmCloseMultiSelectMoreMenu();
        };
        state.multiSelectMenuEl = menu;
        state.multiSelectMenuAnchorEl = anchor;
        state.multiSelectMenuCloseHandler = closeHandler;
        __tmBindOutsideCloseHandler(closeHandler, '.tm-multi-bulkbar__menu, [data-tm-multi-more-btn]');
    }

    window.tmMultiSelectToggleMoreMenu = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const anchor = ev?.currentTarget instanceof Element
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('[data-tm-multi-more-btn]') : null);
        if (!(anchor instanceof Element)) return;
        if (state.multiSelectMenuEl && state.multiSelectMenuAnchorEl === anchor) {
            __tmCloseMultiSelectMoreMenu();
            return;
        }
        __tmOpenMultiSelectMoreMenu(anchor);
    };

    let __tmTaskDetailMoreMenuEl = null;
    let __tmTaskDetailMoreMenuAnchorEl = null;
    let __tmTaskDetailMoreMenuCloseHandler = null;

    function __tmCloseTaskDetailMoreMenu() {
        try {
            if (__tmTaskDetailMoreMenuCloseHandler) {
                __tmClearOutsideCloseHandler(__tmTaskDetailMoreMenuCloseHandler);
            }
        } catch (e) {}
        try { __tmTaskDetailMoreMenuEl?.remove?.(); } catch (e) {}
        __tmTaskDetailMoreMenuEl = null;
        __tmTaskDetailMoreMenuAnchorEl = null;
        __tmTaskDetailMoreMenuCloseHandler = null;
    }

    function __tmBuildTaskDetailMoreMenuItem(label, iconName, onClick, options = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-multi-bulkbar__menu-item';
        if (options.disabled) btn.disabled = true;
        if (options.danger) btn.style.color = 'var(--b3-theme-error)';
        if (String(options.labelHtml || '').trim()) {
            btn.innerHTML = String(options.labelHtml || '').trim();
        } else {
            btn.innerHTML = `<span class="tm-multi-bulkbar__menu-icon">${__tmPhosphorBoldSvg(iconName, { size: 14, className: 'tm-multi-bulkbar__menu-icon-svg' })}</span><span>${esc(String(label || '').trim())}</span>`;
        }
        btn.onclick = async (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            if (btn.disabled) return;
            __tmCloseTaskDetailMoreMenu();
            try { await onClick?.(); } catch (e) {}
        };
        return btn;
    }

    async function __tmResolveTaskDetailTimerTarget(taskId) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return null;
        let resolvedId = rawId;
        try {
            const nextId = await __tmResolveTaskIdFromAnyBlockId(rawId);
            if (nextId) resolvedId = String(nextId).trim();
        } catch (e) {}
        let task = globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedId)
            || globalThis.__tmRuntimeState?.getFlatTaskById?.(rawId)
            || state.flatTasks?.[resolvedId]
            || state.flatTasks?.[rawId]
            || null;
        if (!task && resolvedId) {
            try { task = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { task = null; }
        }
        if (!task) return null;
        return {
            taskId: resolvedId || rawId,
            taskName: __tmNormalizeTimerTaskName(task?.content || task?.markdown || '', '任务'),
        };
    }

    async function __tmStartTaskDetailQuickTimer(taskId, minutes, mode = 'countdown') {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const timer = globalThis.__tomatoTimer;
        if (!timer || typeof timer !== 'object') {
            hint('⚠ 未检测到番茄计时功能，请确认番茄插件已启用', 'warning');
            return;
        }
        const target = await __tmResolveTaskDetailTimerTarget(taskId);
        const timerTaskId = String(target?.taskId || taskId || '').trim();
        const timerTaskName = String(target?.taskName || '任务').trim() || '任务';
        if (!timerTaskId) {
            hint('⚠ 未找到可关联的任务块', 'warning');
            return;
        }
        state.timerFocusTaskId = timerTaskId;
        try { render(); } catch (e) {}
        if (mode === 'stopwatch') {
            const startFromTaskBlock = timer?.startFromTaskBlock;
            const startStopwatch = timer?.startStopwatch;
            let p = null;
            if (typeof startFromTaskBlock === 'function') {
                p = startFromTaskBlock(timerTaskId, timerTaskName, 0, 'stopwatch');
            } else if (typeof startStopwatch === 'function') {
                p = startStopwatch(timerTaskId, timerTaskName);
            } else {
                hint('⚠ 未检测到正计时功能，请确认番茄插件已启用', 'warning');
                return;
            }
            if (p && typeof p.finally === 'function') {
                p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
            } else {
                setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
            }
            await p;
            return;
        }
        const safeMin = Math.max(1, Math.round(Number(minutes) || 0));
        const startFromTaskBlock = timer?.startFromTaskBlock;
        const startCountdown = timer?.startCountdown;
        let p = null;
        if (typeof startFromTaskBlock === 'function') {
            p = startFromTaskBlock(timerTaskId, timerTaskName, safeMin, 'countdown');
        } else if (typeof startCountdown === 'function') {
            p = startCountdown(timerTaskId, timerTaskName, safeMin);
        } else {
            await tmStartPomodoro(timerTaskId);
            return;
        }
        if (p && typeof p.finally === 'function') {
            p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
        } else {
            setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
        }
        await p;
    }

    function __tmBuildTaskDetailMoreTimerSection(taskId) {
        if (!SettingsStore.data.enableTomatoIntegration) return null;
        const timer = globalThis.__tomatoTimer;
        if (!timer || typeof timer !== 'object') return null;
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        const wrap = document.createElement('div');
        wrap.className = 'tm-task-detail-more-menu__timer-section';
        const title = document.createElement('div');
        title.className = 'tm-task-detail-more-menu__timer-title';
        title.textContent = '计时';
        wrap.appendChild(title);
        const row = document.createElement('div');
        row.className = 'tm-task-detail-more-menu__timer-row';
        const durations = (() => {
            const list = timer?.getDurations?.();
            const arr = Array.isArray(list) ? list.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0) : [];
            return arr.length > 0 ? arr.slice(0, 8) : [5, 15, 25, 30, 45, 60];
        })();
        const buttons = [
            ...durations.map((min) => ({ label: `${min}m`, minutes: min, mode: 'countdown' })),
            { label: '正计时', minutes: 0, mode: 'stopwatch', icon: 'timer' },
        ];
        buttons.forEach((item) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tm-task-detail-more-menu__timer-btn';
            btn.innerHTML = item.icon
                ? `${__tmRenderLucideIcon(item.icon)}<span>${esc(item.label)}</span>`
                : `<span>${esc(item.label)}</span>`;
            btn.onclick = async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                __tmCloseTaskDetailMoreMenu();
                await __tmStartTaskDetailQuickTimer(tid, item.minutes, item.mode);
            };
            row.appendChild(btn);
        });
        wrap.appendChild(row);
        return wrap;
    }

    function __tmBuildTaskDetailMoreActions(taskId) {
        const tid = String(taskId || '').trim();
        const task = tid ? (globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null) : null;
        if (!tid || !task) return [];
        const actions = [];
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const hasChildren = Array.isArray(task?.children) && task.children.length > 0;
        const showCompletedSubtasks = __tmShouldShowCompletedSubtasksForTask(tid);
        const canEditSchedule = !!(globalThis.__tmCalendar
            && (typeof globalThis.__tmCalendar.openScheduleEditor === 'function'
                || typeof globalThis.__tmCalendar.openScheduleEditorById === 'function'
                || typeof globalThis.__tmCalendar.openScheduleEditorByTaskId === 'function'));
        const aiEnabled = __tmIsAiFeatureEnabled();

        actions.push({
            label: task?.pinned ? '取消置顶' : '置顶',
            icon: 'pin',
            run: async () => { await window.tmSetPinned?.(tid, !task?.pinned); }
        });
        if (tomatoEnabled) {
            actions.push({
                label: '提醒',
                icon: 'alarm-clock',
                run: async () => { await window.tmReminder?.(tid); }
            });
            actions.push({
                label: '开始专注',
                icon: 'timer',
                run: async () => { await window.tmStartPomodoro?.(tid); }
            });
        }
        if (hasChildren) {
            actions.push({
                label: showCompletedSubtasks ? '隐藏已完成子任务' : '显示已完成子任务',
                icon: showCompletedSubtasks ? 'check-circle-2' : 'circle-dot',
                run: async () => { await window.tmToggleTaskDetailCompletedSubtasks?.(tid, !showCompletedSubtasks); }
            });
        }

        actions.push({ separator: true });
        actions.push({
            label: '新建子任务',
            icon: 'text-indent',
            run: async () => { await window.tmCreateSubtask?.(tid); }
        });
        actions.push({
            label: '新建同级任务',
            icon: 'list-bullets',
            run: async () => { await window.tmCreateSiblingTask?.(tid); }
        });
        if (canEditSchedule) {
            actions.push({
                label: '编辑日程',
                icon: 'calendar-days',
                run: async () => { await __tmOpenScheduleEditorForBlock(tid, null, { blockId: tid }); }
            });
        }

        if (aiEnabled) {
            actions.push({ separator: true });
            actions.push({
                label: 'AI 优化任务名称',
                icon: 'bot',
                run: async () => { try { await globalThis.tmAiOptimizeTaskName?.(tid); } catch (e) {} }
            });
            actions.push({
                label: 'AI 编辑字段',
                icon: 'bot',
                run: async () => { try { await globalThis.tmAiEditTask?.(tid); } catch (e) {} }
            });
            actions.push({
                label: 'AI 安排日程',
                icon: 'bot',
                run: async () => { try { await globalThis.tmAiPlanTaskSchedule?.(tid); } catch (e) {} }
            });
        }

        actions.push({ separator: true });
        actions.push({
            label: '删除任务',
            icon: 'trash-2',
            danger: true,
            labelHtml: __tmRenderContextMenuLabel('trash-2', '删除任务'),
            run: async () => { await window.tmDelete?.(tid); }
        });

        const cleaned = [];
        actions.forEach((item) => {
            const isSeparator = item?.separator === true;
            if (isSeparator) {
                if (!cleaned.length || cleaned[cleaned.length - 1]?.separator === true) return;
                cleaned.push({ separator: true });
                return;
            }
            if (!item || typeof item.run !== 'function') return;
            cleaned.push(item);
        });
        while (cleaned.length && cleaned[cleaned.length - 1]?.separator === true) cleaned.pop();
        return cleaned;
    }

    function __tmOpenTaskDetailMoreMenu(anchorEl, taskId) {
        const anchor = anchorEl instanceof Element ? anchorEl : null;
        const tid = String(taskId || '').trim();
        if (!(anchor instanceof Element) || !tid) return;
        if (__tmTaskDetailMoreMenuEl && __tmTaskDetailMoreMenuAnchorEl === anchor) {
            __tmCloseTaskDetailMoreMenu();
            return;
        }
        __tmCloseTaskDetailMoreMenu();

        const actions = __tmBuildTaskDetailMoreActions(tid);
        const timerSection = __tmBuildTaskDetailMoreTimerSection(tid);
        if (!timerSection && !actions.length) return;

        const menu = document.createElement('div');
        menu.className = 'tm-popup-menu bc-dropdown-menu tm-multi-bulkbar__menu tm-task-detail-more-menu';
        if (timerSection) {
            menu.appendChild(timerSection);
            if (actions.length) {
                const separator = document.createElement('div');
                separator.className = 'tm-multi-bulkbar__menu-separator';
                menu.appendChild(separator);
            }
        }
        actions.forEach((item) => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'tm-multi-bulkbar__menu-separator';
                menu.appendChild(separator);
                return;
            }
            menu.appendChild(__tmBuildTaskDetailMoreMenuItem(item.label, item.icon, item.run, {
                danger: item.danger === true,
                disabled: item.disabled === true,
                labelHtml: item.labelHtml,
            }));
        });

        document.body.appendChild(menu);
        const rect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const margin = 8;
        const viewportHeight = Math.max(0, window.innerHeight || document.documentElement?.clientHeight || 0);
        let left = Math.round(rect.right - menuRect.width);
        let top = Math.round(rect.bottom + 8);
        if ((top + menuRect.height > viewportHeight - margin) && (rect.top - menuRect.height - 8 >= margin)) {
            top = Math.round(rect.top - menuRect.height - 8);
        }
        try { menu.style.left = `${Math.max(margin, left)}px`; } catch (e) {}
        try { menu.style.top = `${Math.max(margin, top)}px`; } catch (e) {}
        try { __tmClampFloatingMenuToViewport(menu, left, top, { margin }); } catch (e) {}

        const closeHandler = (ev) => {
            const target = ev?.target instanceof Element ? ev.target : null;
            if (target?.closest?.('.tm-task-detail-more-menu')) return;
            if (target?.closest?.('[data-tm-detail="more"]')) return;
            __tmCloseTaskDetailMoreMenu();
        };
        __tmTaskDetailMoreMenuEl = menu;
        __tmTaskDetailMoreMenuAnchorEl = anchor;
        __tmTaskDetailMoreMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler, {
            ignoreSelector: '.tm-task-detail-more-menu, [data-tm-detail="more"]',
        });
    }

    // 显示规则管理器
    async function showRulesManager() {
        if (state.rulesModal) return;

        state.rulesModal = document.createElement('div');
        state.rulesModal.className = 'tm-rules-manager';

        state.rulesModal.innerHTML = `
            <div class="tm-rules-box">
                <div class="tm-rules-header">
                    <div class="tm-rules-title">📋 筛选规则管理器</div>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="showPriorityScoreSettings">
                            优先级算法
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="addNewRule">
                            <span>+</span> 添加规则
                        </button>
                    </div>
                </div>

                <div class="tm-rules-body">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-bottom:1px solid var(--tm-border-color); background: var(--tm-bg-color);">
                        <div style="font-size:13px; color: var(--tm-text-color);">时间轴强制按截止日期排序（越近今天越靠前）</div>
                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.timelineForceSortByCompletionNearToday ? 'checked' : ''} onchange="tmToggleTimelineForceSortByCompletionNearToday(this.checked)">
                    </div>
                    ${renderRulesList()}
                </div>

                <div class="tm-rules-footer">
                    <div class="tm-rule-info">
                        当前有 ${state.filterRules.filter(r => r.enabled).length} 个启用的规则
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="closeRulesManager">取消</button>
                        <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="saveRules">保存规则</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(state.rulesModal);
        __tmBindRulesManagerEvents(state.rulesModal);
        state.__rulesUnstack = __tmModalStackBind(() => window.closeRulesManager?.());
    }

    function __tmBindRulesManagerEvents(rootEl) {
        const root = rootEl || state.rulesModal;
        if (!root || root.__tmRulesManagerBound) return;
        root.__tmRulesManagerBound = true;

        root.addEventListener('click', async (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-action]');
            if (!target || !root.contains(target)) return;
            const tag = String(target.tagName || '').toLowerCase();
            if (tag === 'select' || tag === 'input' || tag === 'textarea' || tag === 'option') return;
            e.preventDefault();

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                return await fn(...args);
            }

            const action = String(target.dataset.tmAction || '');
            const ruleId = String(target.dataset.ruleId || '');
            const index = target.dataset.index !== undefined ? Number(target.dataset.index) : NaN;
            const delta = target.dataset.delta !== undefined ? Number(target.dataset.delta) : NaN;
            const tab = String(target.dataset.tab || '');

            if (action === 'editRule') return window.editRule?.(ruleId);
            if (action === 'deleteRule') return window.deleteRule?.(ruleId);
            if (action === 'applyRuleNow') return window.applyRuleNow?.(ruleId);
            if (action === 'removeCondition') return window.removeCondition?.(index);
            if (action === 'moveSortRule') return window.moveSortRule?.(index, delta);
            if (action === 'removeSortRule') return window.removeSortRule?.(index);
            if (action === 'tmSwitchSettingsTab') return window.tmSwitchSettingsTab?.(tab);

            const fn = window[action];
            if (typeof fn === 'function') return await fn();
        });

        root.addEventListener('change', (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-change]');
            if (!target || !root.contains(target)) return;

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                const val = (target.type === 'checkbox') ? !!target.checked : target.value;
                return fn(...args, val);
            }

            const changeType = String(target.dataset.tmChange || '');
            const ruleId = String(target.dataset.ruleId || '');
            const index = target.dataset.index !== undefined ? Number(target.dataset.index) : NaN;
            const optionValue = String(target.dataset.optionValue || '');
            const rangeKey = String(target.dataset.rangeKey || '');

            if (changeType === 'toggleRuleEnabled') return window.toggleRuleEnabled?.(ruleId, !!target.checked);
            if (changeType === 'updateConditionField') return window.updateConditionField?.(index, target.value);
            if (changeType === 'updateConditionOperator') return window.updateConditionOperator?.(index, target.value);
            if (changeType === 'updateConditionMatchMode') return window.updateConditionMatchMode?.(index, target.value);
            if (changeType === 'updateConditionValue') return window.updateConditionValue?.(index, target.value);
            if (changeType === 'toggleConditionMultiValue') return window.toggleConditionMultiValue?.(index, optionValue, !!target.checked);
            if (changeType === 'updateConditionValueRange') return window.updateConditionValueRange?.(index, rangeKey, target.value);
            if (changeType === 'updateSortField') return window.updateSortField?.(index, target.value);
            if (changeType === 'updateSortOrder') return window.updateSortOrder?.(index, target.value);
        });

        root.addEventListener('input', (e) => {
            const target = e.target?.closest?.('[data-tm-call],[data-tm-input]');
            if (!target || !root.contains(target)) return;

            const callName = String(target.dataset.tmCall || '');
            if (callName) {
                const fn = window[callName];
                if (typeof fn !== 'function') return;
                let args = [];
                const raw = target.dataset.tmArgs;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        args = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e2) {}
                }
                const val = (target.type === 'checkbox') ? !!target.checked : target.value;
                return fn(...args, val);
            }

            const inputType = String(target.dataset.tmInput || '');
            if (inputType === 'updateEditingRuleName') return window.updateEditingRuleName?.(target.value);
        });
    }

    // 渲染规则列表
    function renderRulesList() {
        const isAddingNew = state.editingRule && !state.filterRules.some(r => r.id === state.editingRule.id);

        if (state.filterRules.length === 0 && !isAddingNew) {
            return '<div style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无规则，点击"添加规则"创建</div>';
        }

        let html = state.filterRules.map((rule, index) => renderRuleItem(rule, index)).join('');

        if (isAddingNew) {
            html = renderRuleEditor(state.editingRule) + html;
        }

        return html;
    }

    // 渲染单个规则项
    function renderRuleItem(rule, index) {
        const isEditing = state.editingRule?.id === rule.id;

        if (isEditing) {
            return renderRuleEditor(rule);
        }

        const conditionText = rule.conditions.length > 0
            ? rule.conditions.map(c => {
                const field = RuleManager.getFieldInfo(c.field);
                let valueDisplay = c.value;

                if (field?.type === 'select') {
                    const rawValues = Array.isArray(c.value)
                        ? c.value
                        : ((c.operator === 'in' || c.operator === 'not_in') && typeof c.value === 'string' && c.value.includes(','))
                            ? c.value.split(',').map(v => v.trim())
                            : [c.value];
                    valueDisplay = rawValues.map((raw) => {
                        const token = String(raw ?? '').trim();
                        if (!token) return RuleManager.getSelectFieldLabel(field, '');
                        return RuleManager.getSelectFieldLabel(field, token);
                    }).filter(Boolean).join('、');
                    if (!valueDisplay) valueDisplay = RuleManager.getSelectFieldLabel(field, '');
                } else if (field?.type === 'boolean') {
                    if (c.value === true || c.value === 'true') valueDisplay = 'true';
                    else if (c.value === false || c.value === 'false') valueDisplay = 'false';
                    else valueDisplay = 'true';
                }

                // 多值显示处理
                if (Array.isArray(c.value) && field?.type !== 'select') {
                    if (c.value.length > 1) {
                        valueDisplay = c.value.join('、');
                    } else {
                        valueDisplay = c.value[0] || '无';
                    }
                } else if ((c.operator === 'in' || c.operator === 'not_in') && field?.type !== 'select') {
                    // 兼容旧格式（逗号分隔的字符串）
                    if (typeof c.value === 'string' && c.value.includes(',')) {
                        valueDisplay = c.value.split(',').join('、');
                    }
                }
                const matchModeText = (field?.multi && (c.operator === 'in' || c.operator === 'not_in'))
                    ? `（${RuleManager.normalizeConditionMatchMode(c, field) === 'all' ? '全部匹配' : '匹配任一'}）`
                    : '';

                return `${field?.label || c.field} ${c.operator}${matchModeText} ${valueDisplay}`;
            }).join('， ')
            : '无条件';

        const sortText = __tmRuleHasExplicitSort(rule)
            ? rule.sort.map((s, i) => {
                const fieldLabel = (RuleManager.getSortFields().find(f => f.value === s.field)?.label || s.field);
                return `${i + 1}. ${fieldLabel} (${s.order === 'desc' ? '降序' : '升序'})`;
            }).join(' → ')
            : '无排序';

        return `
            <div class="tm-rule-group">
                <div class="tm-rule-group-header">
                    <div class="tm-rule-group-title">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${rule.enabled ? 'checked' : ''}
                               data-tm-change="toggleRuleEnabled"
                               data-rule-id="${esc(String(rule.id))}"
                               style="margin-right: 8px;">
                        ${esc(rule.name)}
                        ${state.currentRule === rule.id ? '<span style="color: var(--tm-success-color); margin-left: 8px;">(当前应用)</span>' : ''}
                    </div>
                    <div class="tm-rule-group-controls">
                        <button class="tm-rule-btn tm-rule-btn-primary" data-tm-action="editRule" data-rule-id="${esc(String(rule.id))}">
                            编辑
                        </button>
                        <button class="tm-rule-btn tm-rule-btn-danger" data-tm-action="deleteRule" data-rule-id="${esc(String(rule.id))}">
                            删除
                        </button>
                    </div>
                </div>

                <div style="font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 8px;">
                    <strong>筛选条件：</strong>${conditionText}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    <strong>排序规则：</strong>${sortText}
                </div>

                <div class="tm-rule-actions">
                    <button class="tm-rule-btn tm-rule-btn-primary" data-tm-action="applyRuleNow" data-rule-id="${esc(String(rule.id))}">
                        立即应用
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染规则编辑器
    function renderRuleEditor(rule) {
        const availableFields = RuleManager.getAvailableFields();
        const sortFields = RuleManager.getSortFields();

        return `
            <div class="tm-rule-group">
                <div class="tm-rule-group-header">
                    <input type="text" class="tm-rule-input" value="${esc(rule.name)}"
                           placeholder="规则名称" data-tm-input="updateEditingRuleName">
                </div>

                <div class="tm-rule-section">
                    <div class="tm-rule-section-title">
                        <span>筛选条件</span>
                        <button class="tm-rule-btn tm-rule-btn-add" data-tm-action="addCondition">
                            + 添加条件
                        </button>
                    </div>
                    <div class="tm-rule-conditions">
                        ${renderConditions(rule.conditions)}
                    </div>
                </div>

                <div class="tm-rule-section">
                    <div class="tm-rule-section-title">
                        <span>排序规则</span>
                        <button class="tm-rule-btn tm-rule-btn-add" data-tm-action="addSortRule">
                            + 添加排序
                        </button>
                    </div>
                    <div class="tm-rule-sort-items">
                        ${renderSortRules(rule.sort)}
                    </div>
                </div>

                <div class="tm-rule-actions">
                    <button class="tm-rule-btn tm-rule-btn-secondary" data-tm-action="cancelEditRule">
                        取消
                    </button>
                    <button class="tm-rule-btn tm-rule-btn-success" data-tm-action="saveEditRule">
                        保存规则
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染条件列表
    function renderConditions(conditions) {
        if (conditions.length === 0) {
            return '<div style="text-align: center; padding: 10px; color: var(--tm-secondary-text);">暂无筛选条件</div>';
        }

        const availableFields = RuleManager.getAvailableFields();

        return conditions.map((condition, index) => {
            const field = availableFields.find(f => f.value === condition.field) || RuleManager.getFieldInfo(condition.field);
            const operators = RuleManager.getOperators(field?.type || 'text');

            return `
                <div class="tm-rule-condition">
                    <select class="tm-rule-condition-field" data-tm-change="updateConditionField" data-index="${index}">
                        ${availableFields.map(f =>
                            `<option value="${esc(f.value)}" ${condition.field === f.value ? 'selected' : ''}>
                                ${esc(f.label)}
                            </option>`
                        ).join('')}
                    </select>
                    <select class="tm-rule-condition-operator" data-tm-change="updateConditionOperator" data-index="${index}">
                        ${operators.map(op =>
                            `<option value="${esc(op.value)}" ${condition.operator === op.value ? 'selected' : ''}>
                                ${esc(op.label)}
                            </option>`
                        ).join('')}
                    </select>
                    ${renderConditionValue(condition, index, field)}
                    <button class="tm-rule-btn tm-rule-btn-danger" data-tm-action="removeCondition" data-index="${index}">
                        ×
                    </button>
                </div>
            `;
        }).join('');
    }

    // 渲染条件值输入
    function renderConditionValue(condition, index, fieldInfo) {
        const fieldType = String(fieldInfo?.type || '').trim() || 'text';
        if (fieldType === 'boolean') {
            return `
                <select class="tm-rule-condition-value" data-tm-change="updateConditionValue" data-index="${index}">
                    <option value="__all__" ${String(condition.value) === '__all__' ? 'selected' : ''}>所有状态(忽略不查找已完成父任务)</option>
                    <option value="true" ${condition.value === true || condition.value === 'true' ? 'selected' : ''}>是</option>
                    <option value="false" ${condition.value === false || condition.value === 'false' ? 'selected' : ''}>否</option>
                </select>
            `;
        }

        if (fieldType === 'select') {
            // 准备选项和显示标签
            const allOptions = Array.isArray(fieldInfo?.options) ? fieldInfo.options.slice() : [];
            const optionLabels = (fieldInfo?.optionLabels && typeof fieldInfo.optionLabels === 'object')
                ? fieldInfo.optionLabels
                : {};
            const multiOptions = fieldInfo?.allowEmpty ? [...allOptions, ''] : allOptions;

            // 如果操作符是 in 或 not_in，显示多选框组
            if (condition.operator === 'in' || condition.operator === 'not_in') {
                const rawSelectedValues = Array.isArray(condition.value)
                    ? condition.value
                    : (typeof condition.value === 'string' && condition.value.includes(','))
                        ? condition.value.split(',').map(v => v.trim())
                        : [condition.value];
                const emptyTokenSet = new Set(['', '无', '未设置', String(fieldInfo?.emptyLabel || '').trim()].filter(Boolean));
                const selectedValueSet = new Set();
                rawSelectedValues.forEach((item) => {
                    const raw = String(item ?? '').trim();
                    if (emptyTokenSet.has(raw)) {
                        selectedValueSet.add('');
                        return;
                    }
                    const normalizedList = RuleManager.normalizeSelectFieldValues(fieldInfo, raw);
                    if (normalizedList.length) {
                        normalizedList.forEach((token) => selectedValueSet.add(token));
                        return;
                    }
                    selectedValueSet.add(raw);
                });
                const matchMode = RuleManager.normalizeConditionMatchMode(condition, fieldInfo);

                return `
                    <div style="display:flex; flex:1; min-width:200px; flex-direction:column; gap:8px;">
                        ${fieldInfo?.multi ? `
                            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:12px; color: var(--tm-secondary-text);">
                                <span>匹配方式</span>
                                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                    <input type="radio"
                                           name="tm-condition-match-mode-${index}"
                                           value="any"
                                           ${matchMode !== 'all' ? 'checked' : ''}
                                           data-tm-change="updateConditionMatchMode"
                                           data-index="${index}">
                                    <span>匹配任一（或）</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                    <input type="radio"
                                           name="tm-condition-match-mode-${index}"
                                           value="all"
                                           ${matchMode === 'all' ? 'checked' : ''}
                                           data-tm-change="updateConditionMatchMode"
                                           data-index="${index}">
                                    <span>全部匹配（与）</span>
                                </label>
                            </div>
                        ` : ''}
                        <div class="tm-multi-select" style="display: flex; flex-wrap: wrap; gap: 8px; min-width: 200px;">
                            ${multiOptions.map(opt => `
                                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox"
                                           ${selectedValueSet.has(String(opt)) ? 'checked' : ''}
                                           data-tm-change="toggleConditionMultiValue"
                                           data-index="${index}"
                                           data-option-value="${esc(String(opt))}">
                                    <span>${esc(opt === '' ? RuleManager.getSelectFieldLabel(fieldInfo, '') : (optionLabels[opt] || opt))}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            // 否则显示单选下拉框
            // 如果值是数组（之前是in/not_in），转为空字符串
            const singleValue = Array.isArray(condition.value) ? '' : condition.value;

            return `
                <select class="tm-rule-condition-value" data-tm-change="updateConditionValue" data-index="${index}">
                    <option value="">-- 请选择 --</option>
                    ${allOptions.map(opt =>
                        `<option value="${esc(String(opt))}" ${singleValue === opt ? 'selected' : ''}>
                            ${esc(opt === '' ? RuleManager.getSelectFieldLabel(fieldInfo, '') : (optionLabels[opt] || opt))}
                        </option>`
                    ).join('')}
                </select>
            `;
        }

        if (condition.operator === 'between' && (fieldType === 'datetime' || fieldType === 'number')) {
            const inputType = fieldType === 'datetime' ? 'date' : 'number';
            return `
                <div class="tm-time-range">
                    <input type="${inputType}"
                           class="tm-time-input"
                           placeholder="开始值"
                           value="${esc(String(condition.value?.from || ''))}"
                           data-tm-change="updateConditionValueRange"
                           data-index="${index}"
                           data-range-key="from">
                    <span class="tm-time-separator">至</span>
                    <input type="${inputType}"
                           class="tm-time-input"
                           placeholder="结束值"
                           value="${esc(String(condition.value?.to || ''))}"
                           data-tm-change="updateConditionValueRange"
                           data-index="${index}"
                           data-range-key="to">
                </div>
            `;
        }

        return `
            <input type="text" class="tm-rule-condition-value"
                   value="${esc(String(condition.value || ''))}"
                   placeholder="输入值"
                   data-tm-change="updateConditionValue"
                   data-index="${index}">
        `;
    }

    // 渲染排序规则
    function renderSortRules(sortRules) {
        if (sortRules.length === 0) {
            return '<div style="text-align: center; padding: 10px; color: var(--tm-secondary-text);">暂无排序规则</div>';
        }

        const sortFields = RuleManager.getSortFields();

        return sortRules.map((sortRule, index) => `
            <div class="tm-rule-sort-item">
                <select class="tm-rule-sort-field" data-tm-change="updateSortField" data-index="${index}">
                    ${sortFields.map(f =>
                        `<option value="${f.value}" ${sortRule.field === f.value ? 'selected' : ''}>
                            ${f.label}
                        </option>`
                    ).join('')}
                </select>
                <select class="tm-rule-sort-order" data-tm-change="updateSortOrder" data-index="${index}">
                    <option value="asc" ${sortRule.order === 'asc' ? 'selected' : ''}>升序</option>
                    <option value="desc" ${sortRule.order === 'desc' ? 'selected' : ''}>降序</option>
                </select>
                <button class="tm-rule-btn tm-rule-btn-secondary tm-rule-sort-move-btn" data-tm-action="moveSortRule" data-index="${index}" data-delta="-1" ${index === 0 ? 'disabled' : ''}><span>↑</span></button>
                <button class="tm-rule-btn tm-rule-btn-secondary tm-rule-sort-move-btn" data-tm-action="moveSortRule" data-index="${index}" data-delta="1" ${index === sortRules.length - 1 ? 'disabled' : ''}><span>↓</span></button>
                <button class="tm-rule-btn tm-rule-btn-danger tm-rule-sort-remove-btn" data-tm-action="removeSortRule" data-index="${index}">
                    ×
                </button>
            </div>
        `).join('');
    }

    // 全局规则管理函数
    window.showRulesManager = showRulesManager;

    function __tmGetDefaultPriorityScoreConfig() {
        return {
            base: 100,
            weights: { importance: 1, status: 1, due: 1, duration: 1, doc: 1 },
            importanceDelta: { high: 20, medium: 10, low: -5, none: 0 },
            statusDelta: { todo: 0, in_progress: 15, done: -80, blocked: -10, review: 5 },
            dueRanges: [
                { days: 0, delta: 20 },
                { days: 1, delta: 15 },
                { days: 3, delta: 10 },
                { days: 7, delta: 5 },
                { days: 30, delta: 0 }
            ],
            durationUnit: 'minutes',
            durationBuckets: [
                { maxMinutes: 15, delta: 10 },
                { maxMinutes: 60, delta: 0 },
                { maxMinutes: 240, delta: -5 },
                { maxMinutes: 999999, delta: -10 }
            ],
            docDeltas: {},
            groupDeltas: {}
        };
    }

    function __tmCloneJson(obj) {
        try { return JSON.parse(JSON.stringify(obj || {})); } catch (e) { return {}; }
    }

    function __tmEnsurePriorityDraft() {
        const base = __tmGetDefaultPriorityScoreConfig();
        const cur = (SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
            ? SettingsStore.data.priorityScoreConfig
            : {};
        const merged = { ...base, ...__tmCloneJson(cur) };
        merged.weights = { ...base.weights, ...(merged.weights || {}) };
        merged.importanceDelta = { ...base.importanceDelta, ...(merged.importanceDelta || {}) };
        merged.statusDelta = { ...base.statusDelta, ...(merged.statusDelta || {}) };
        merged.dueRanges = Array.isArray(merged.dueRanges) ? merged.dueRanges : base.dueRanges;
        merged.durationUnit = (merged.durationUnit === 'hours' || merged.durationUnit === 'minutes') ? merged.durationUnit : 'minutes';
        merged.durationBuckets = Array.isArray(merged.durationBuckets) ? merged.durationBuckets : base.durationBuckets;
        merged.docDeltas = (merged.docDeltas && typeof merged.docDeltas === 'object') ? merged.docDeltas : {};
        merged.groupDeltas = (merged.groupDeltas && typeof merged.groupDeltas === 'object') ? merged.groupDeltas : {};

        const statuses = SettingsStore.data.customStatusOptions || [];
        statuses.forEach(s => {
            const id = String(s?.id || '').trim();
            if (!id) return;
            if (merged.statusDelta[id] === undefined) merged.statusDelta[id] = 0;
        });
        return merged;
    }

    function __tmRenderPriorityScoreSettings(isEmbeddedInSettings) {
        const embedded = !!isEmbeddedInSettings;
        const cfg = state.priorityScoreDraft || __tmEnsurePriorityDraft();
        const statuses = SettingsStore.data.customStatusOptions || [];
        const docs = state.allDocuments || [];
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const docRows = Object.entries(cfg.docDeltas || {}).map(([docId, delta]) => {
            const dName = docs.find(d => d.id === docId)?.name;
            return `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
                    <button class="tm-btn tm-btn-secondary" data-tm-call="tmPickPriorityDocDelta" data-tm-args='["${esc(docId)}"]' style="flex:1;min-width:180px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(dName || docId)}</span>
                        <span style="opacity:0.8;">▾</span>
                    </button>
                    <input class="tm-input" style="width:120px;" type="number" value="${Number(delta) || 0}" data-tm-call="tmSetPriorityDocDelta" data-tm-args='["${esc(docId)}"]'>
                    <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDocDelta" data-tm-args='["${esc(docId)}"]'>删除</button>
                </div>
            `;
        }).join('');
        const groupRows = Object.entries(cfg.groupDeltas || {}).map(([groupId, delta]) => {
            const group = groups.find((item) => String(item?.id || '').trim() === String(groupId || '').trim());
            return `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
                    <button class="tm-btn tm-btn-secondary" data-tm-call="tmPickPriorityGroupDelta" data-tm-args='["${esc(groupId)}"]' style="flex:1;min-width:180px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(group ? __tmResolveDocGroupName(group) : groupId)}</span>
                        <span style="opacity:0.8;">▾</span>
                    </button>
                    <input class="tm-input" style="width:120px;" type="number" value="${Number(delta) || 0}" data-tm-call="tmSetPriorityGroupDelta" data-tm-args='["${esc(groupId)}"]'>
                    <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityGroupDelta" data-tm-args='["${esc(groupId)}"]'>删除</button>
                </div>
            `;
        }).join('');

        const dueRows = (Array.isArray(cfg.dueRanges) ? cfg.dueRanges : []).map((r, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">≤ 天数</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.days) || 0}" data-tm-call="tmSetPriorityDueRange" data-tm-args='[${i},"days"]'>
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(r.delta) || 0}" data-tm-call="tmSetPriorityDueRange" data-tm-args='[${i},"delta"]'>
                <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDueRange" data-tm-args='[${i}]'>删除</button>
            </div>
        `).join('');

        const durationUnit = (cfg.durationUnit === 'hours' || cfg.durationUnit === 'minutes') ? cfg.durationUnit : 'minutes';
        const __tmDurationBucketToInputValue = (maxMinutes) => {
            const m = Number(maxMinutes);
            if (!Number.isFinite(m)) return 0;
            const v = durationUnit === 'hours' ? (m / 60) : m;
            return Math.round(v * 100) / 100;
        };
        const durationLabel = durationUnit === 'hours' ? '≤ 小时' : '≤ 分钟';
        const durRows = (Array.isArray(cfg.durationBuckets) ? cfg.durationBuckets : []).map((b, i) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                <span style="width:70px;color:var(--tm-secondary-text);">${durationLabel}</span>
                <input class="tm-input" style="width:120px;" type="number" value="${__tmDurationBucketToInputValue(b.maxMinutes)}" data-tm-call="tmSetPriorityDurationBucket" data-tm-args='[${i},"maxMinutes"]'>
                <span style="width:40px;color:var(--tm-secondary-text);">加分</span>
                <input class="tm-input" style="width:120px;" type="number" value="${Number(b.delta) || 0}" data-tm-call="tmSetPriorityDurationBucket" data-tm-args='[${i},"delta"]'>
                <button class="tm-btn tm-btn-gray" data-tm-call="tmRemovePriorityDurationBucket" data-tm-args='[${i}]'>删除</button>
            </div>
        `).join('');

        if (embedded) {
            return `
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="font-weight: 700; font-size: 15px;">⚙️ 优先级算法</div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="font-weight: 700; margin-bottom: 10px;">基础分</div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <input class="tm-input" type="number" value="${Number(cfg.base) || 100}" data-tm-call="tmSetPriorityBase" style="width: 180px;">
                            <div style="font-size: 12px; color: var(--tm-secondary-text);">用于所有任务的起始分</div>
                        </div>
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="font-weight: 700; margin-bottom: 10px;">权重（微调）</div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">重要性 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.importance) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["importance"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">状态 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.status) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["status"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">截止日期 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.due) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["due"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">时长 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.duration) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["duration"]'></label>
                            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">文档 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.weights.doc) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["doc"]'></label>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
                        <div class="tm-rule-section" style="margin-bottom:0;">
                            <div style="font-weight: 700; margin-bottom: 10px;">重要性加减分</div>
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">高 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.high) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["high"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">中 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.medium) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["medium"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">低 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.low) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["low"]'></label>
                                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">无 <input class="tm-input" style="width:120px;max-width:100%;" type="number" value="${Number(cfg.importanceDelta.none) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["none"]'></label>
                            </div>
                        </div>

                        <div class="tm-rule-section" style="margin-bottom:0;">
                            <div style="font-weight: 700; margin-bottom: 10px;">状态加减分</div>
                            <div style="display:flex;flex-wrap:wrap;gap:10px;">
                                ${statuses.map(s => `
                                    <label class="tm-priority-status-row" style="display:flex;align-items:center;gap:8px; padding: 6px 8px; border: 1px solid var(--tm-border-color); border-radius: 8px; background: var(--tm-bg-color);">
                                        <span class="tm-priority-status-name" style="max-width: 140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.name || s.id)}</span>
                                        <input class="tm-input tm-priority-status-input" style="width:110px;" type="number" value="${Number(cfg.statusDelta[s.id]) || 0}" data-tm-call="tmSetPriorityStatus" data-tm-args='["${esc(String(s.id))}"]'>
                                    </label>
                                `).join('')}
                            </div>
                            ${statuses.length === 0 ? '<div style="color: var(--tm-secondary-text); font-size: 12px;">暂无自定义状态</div>' : ''}
                        </div>
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                            <div style="font-weight: 700;">截止日期接近度（按“≤ 天数”匹配）</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDueRange">+ 添加</button>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                            <div style="font-weight: 700;">时长分段</div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                                <select class="tm-input" style="width: 160px;" data-tm-call="tmSetPriorityDurationUnit">
                                    <option value="minutes" ${durationUnit === 'minutes' ? 'selected' : ''}>分钟</option>
                                    <option value="hours" ${durationUnit === 'hours' ? 'selected' : ''}>小时（可小数）</option>
                                </select>
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDurationBucket">+ 添加</button>
                            </div>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                            <div style="font-weight: 700;">文档加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDocDelta">+ 添加</button>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-rule-section" style="margin-bottom:0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                            <div style="font-weight: 700;">文档分组加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityGroupDelta">+ 添加</button>
                        </div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:8px;">给整个文档分组内的文档统一加减分，支持笔记本分组和包含子文档的分组。</div>
                        ${groupRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
            `;
        }

        return `
            <div class="tm-box" style="width: ${embedded ? '100%' : '720px'}; height: auto; ${embedded ? '' : 'max-height: 86vh;'}">
                <div class="tm-header">
                    <div style="font-size: 16px; font-weight: 700; color: var(--tm-text-color);">⚙️ 优先级算法</div>
                    ${embedded
                        ? '<button class="tm-btn tm-btn-gray" data-tm-action="tmSwitchSettingsTab" data-tab="rules">返回</button>'
                        : '<button class="tm-btn tm-btn-gray" data-tm-action="closePriorityScoreSettings">关闭</button>'}
                </div>
                <div style="padding: 14px; overflow: auto;">
                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">基础分</div>
                        <input class="tm-input" type="number" value="${Number(cfg.base) || 100}" data-tm-call="tmSetPriorityBase" style="width: 160px;">
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">权重（微调）</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">重要性 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.importance) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["importance"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">状态 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.status) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["status"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">截止日期 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.due) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["due"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">时长 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.duration) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["duration"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">文档 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.weights.doc) || 1}" data-tm-call="tmSetPriorityWeight" data-tm-args='["doc"]'></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">重要性加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;">高 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.high) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["high"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">中 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.medium) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["medium"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">低 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.low) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["low"]'></label>
                            <label style="display:flex;align-items:center;gap:6px;">无 <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.importanceDelta.none) || 0}" data-tm-call="tmSetPriorityImportance" data-tm-args='["none"]'></label>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px;">状态加减分</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            ${statuses.map(s => `
                                <label style="display:flex;align-items:center;gap:6px;">
                                    ${esc(s.name || s.id)}
                                    <input class="tm-input" style="width:90px;" type="number" value="${Number(cfg.statusDelta[s.id]) || 0}" data-tm-call="tmSetPriorityStatus" data-tm-args='["${esc(String(s.id))}"]'>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">截止日期接近度（按“≤ 天数”匹配）</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDueRange">+ 添加</button>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
                            <div style="font-weight: 700;">时长分段</div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                                <select class="tm-input" style="width: 160px;" data-tm-call="tmSetPriorityDurationUnit">
                                    <option value="minutes" ${durationUnit === 'minutes' ? 'selected' : ''}>分钟</option>
                                    <option value="hours" ${durationUnit === 'hours' ? 'selected' : ''}>小时（可小数）</option>
                                </select>
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDurationBucket">+ 添加</button>
                            </div>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">文档加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDocDelta">+ 添加</button>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                    <div style="margin-bottom: 14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                            <div style="font-weight: 700;">文档分组加减分</div>
                            <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityGroupDelta">+ 添加</button>
                        </div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:8px;">给整个文档分组内的文档统一加减分，支持笔记本分组和包含子文档的分组。</div>
                        ${groupRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
                <div class="tm-settings-footer" style="padding: 12px 14px;">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="closePriorityScoreSettings">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="savePriorityScoreSettings">保存</button>
                </div>
            </div>
        `;
    }

    function showPriorityScoreSettings() {
        if (state.priorityModal) return;
        state.priorityScoreDraft = __tmEnsurePriorityDraft();
        state.priorityModal = document.createElement('div');
        state.priorityModal.className = 'tm-modal';
        state.priorityModal.style.zIndex = '200002';
        state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings(false);
        document.body.appendChild(state.priorityModal);
        __tmBindRulesManagerEvents(state.priorityModal);
        state.__priorityUnstack = __tmModalStackBind(() => window.closePriorityScoreSettings?.());
    }
    window.showPriorityScoreSettings = showPriorityScoreSettings;

    function __tmRerenderPriorityScoreSettings() {
        if (state.priorityModal) {
            state.priorityModal.innerHTML = __tmRenderPriorityScoreSettings(false);
            return;
        }
        const container = state.settingsModal?.querySelector?.('#tm-priority-settings');
        if (container) container.innerHTML = __tmRenderPriorityScoreSettings(true);
    }

    window.closePriorityScoreSettings = function() {
        state.__priorityUnstack?.();
        state.__priorityUnstack = null;
        if (state.priorityModal) {
            state.priorityModal.remove();
            state.priorityModal = null;
            // 只有关闭独立的优先级设置模态框时才重置draft
            state.priorityScoreDraft = null;
        }
        // 在设置界面中切换Tab时，不重置draft，保留用户输入的数据
        if (state.settingsModal && state.settingsActiveTab === 'priority') {
            showSettings();
        }
    };

    window.savePriorityScoreSettings = async function() {
        if (!state.priorityScoreDraft) return;
        SettingsStore.data.priorityScoreConfig = state.priorityScoreDraft;
        await SettingsStore.save();
        try { await __tmWarmPriorityGroupDeltaDocsMap(); } catch (e) {}
        __tmScheduleRender({ withFilters: true });
        closePriorityScoreSettings();
        hint('✅ 优先级算法已保存', 'success');
    };

    // 渲染四象限设置
    function renderQuadrantSettings() {
        const quadrantConfig = SettingsStore.data.quadrantConfig || {
            enabled: false,
            rules: [
                { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'today', 'tomorrow', 'within1days'] },
                { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['within3days', 'beyond3days', 'within7days', 'beyond7days', 'within15days', 'beyond15days', 'within30days', 'beyond30days', 'nodate'] },
                { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'today', 'tomorrow', 'within1days'] },
                { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['within3days', 'beyond3days', 'within7days', 'beyond7days', 'within15days', 'beyond15days', 'within30days', 'beyond30days', 'nodate'] }
            ]
        };

        const rules = quadrantConfig.rules || [];
        const colorLabels = { red: '🔴 红色', yellow: '🟡 黄色', blue: '🔵 蓝色', green: '🟢 绿色' };
        const importanceLabels = { high: '高', medium: '中', low: '低', none: '无' };
        const timeRangeLabels = {
            overdue: '已过期',
            today: '今天',
            tomorrow: '明天',
            within1days: '余1天以内',
            within3days: '余3天以内',
            beyond3days: '余3天以上',
            within7days: '余7天以内',
            beyond7days: '余7天以上',
            within15days: '余15天以内',
            beyond15days: '余15天以上',
            within30days: '余30天以内',
            beyond30days: '余30天以上',
            nodate: '无日期'
        };

        let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

        rules.forEach((rule, index) => {
            const importanceNames = (rule.importance || []).map(i => importanceLabels[i] || i).join('+');
            const timeRangeNames = (rule.timeRanges || []).map(t => timeRangeLabels[t] || t).join('+');

            html += `
                <div style="background: var(--tm-bg-color); border: 1px solid var(--tm-border-color); border-radius: 8px; padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span class="tm-quadrant-indicator tm-quadrant-bg-${rule.color}"></span>
                        <span style="font-weight: 600; color: var(--tm-quadrant-${rule.color});">${esc(rule.name)}</span>
                        <span style="margin-left: auto; color: var(--tm-secondary-text); font-size: 12px;">${colorLabels[rule.color]}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                        <div style="padding: 8px; background: var(--tm-section-bg); border-radius: 4px;">
                            <div style="color: var(--tm-secondary-text); font-size: 11px; margin-bottom: 4px;">重要性</div>
                            <div>${esc(importanceNames)}</div>
                        </div>
                        <div style="padding: 8px; background: var(--tm-section-bg); border-radius: 4px;">
                            <div style="color: var(--tm-secondary-text); font-size: 11px; margin-bottom: 4px;">截止日期</div>
                            <div>${esc(timeRangeNames)}</div>
                        </div>
                    </div>
                    <div style="margin-top: 8px; display: flex; gap: 8px;">
                        <button class="tm-btn tm-btn-secondary" data-tm-call="tmEditQuadrantRule" data-tm-args='[${index}]' style="flex: 1; padding: 4px 8px; font-size: 12px;">编辑规则</button>
                        <button class="tm-btn tm-btn-secondary" data-tm-call="tmResetQuadrantRule" data-tm-args='[${index}]' style="padding: 4px 8px; font-size: 12px;">重置</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        html += `
            <div style="margin-top: 16px; padding: 12px; background: var(--tm-info-bg); border: 1px solid var(--tm-info-border); border-radius: 8px; font-size: 12px; color: var(--tm-secondary-text);">
                <div style="font-weight: 600; margin-bottom: 8px;">📌 使用说明</div>
                <ul style="margin: 0; padding-left: 16px;">
                    <li>在顶部工具栏启用「四象限分组」即可按此规则分组显示</li>
                    <li>任务会根据「重要性」和「截止日期」自动分配到对应象限</li>
                    <li>点击「编辑规则」可自定义每个象限的条件</li>
                    <li>点击「重置」可恢复该象限的默认配置</li>
                </ul>
            </div>
        `;

        return html;
    }

    // 编辑四象限规则
    window.tmEditQuadrantRule = async function(index) {
        const quadrantConfig = SettingsStore.data.quadrantConfig || {
            enabled: false,
            rules: [
                { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'within7days'] },
                { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['beyond7days', 'nodate'] },
                { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'within7days'] },
                { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['beyond7days', 'nodate'] }
            ]
        };

        const rules = quadrantConfig.rules || [];
        const rule = rules[index];
        if (!rule) return;

        const importanceOptions = [
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
            { value: 'none', label: '无' }
        ];

        const timeRangeOptions = [
            { value: 'overdue', label: '已过期' },
            { value: 'within3days', label: '余3天以内' },
            { value: 'beyond3days', label: '余3天以上' },
            { value: 'within7days', label: '余7天以内' },
            { value: 'beyond7days', label: '余7天以上' },
            { value: 'within15days', label: '余15天以内' },
            { value: 'beyond15days', label: '余15天以上' },
            { value: 'within30days', label: '余30天以内' },
            { value: 'beyond30days', label: '余30天以上' },
            { value: 'nodate', label: '无日期' }
        ];

        // 根据象限类型过滤时间范围选项
        // 判断是否紧急象限：ID必须以 'urgent-' 开头（urgent-important, urgent-not-important）
        const isUrgent = rule.id && (rule.id.startsWith('urgent-') || rule.id === 'urgent-important' || rule.id === 'urgent-not-important');
        const filteredTimeRangeOptions = timeRangeOptions.filter(opt => {
            if (isUrgent) {
                // 紧急象限：只显示已过期、以及余X天以内
                return opt.value === 'overdue' || opt.value.startsWith('within');
            } else {
                // 不紧急象限：只显示无日期、以及余X天以上
                return opt.value === 'nodate' || opt.value.startsWith('beyond');
            }
        });

        const importanceCheckboxes = importanceOptions.map(opt => `
            <label style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; margin-bottom: 6px; cursor: pointer; white-space: nowrap;">
                <input type="checkbox" value="${opt.value}" ${rule.importance?.includes(opt.value) ? 'checked' : ''} data-quadrant-importance>
                ${opt.label}
            </label>
        `).join('');

        const timeRangeCheckboxes = filteredTimeRangeOptions.map(opt => `
            <label style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; margin-bottom: 6px; cursor: pointer; white-space: nowrap;">
                <input type="checkbox" value="${opt.value}" ${rule.timeRanges?.includes(opt.value) ? 'checked' : ''} data-quadrant-timerange>
                ${opt.label}
            </label>
        `).join('');

        const modal = document.createElement('div');
        modal.className = 'tm-quick-add-modal';
        modal.innerHTML = `
            <div class="tm-prompt-box" style="width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto; box-sizing: border-box;">
                <div class="tm-prompt-title">编辑四象限规则 - ${esc(rule.name)}</div>
                <div style="margin-bottom: 16px; max-height: 60vh; overflow-y: auto;">
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">重要性（可多选）</div>
                        ${importanceCheckboxes}
                    </div>
                    <div>
                        <div style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">截止日期范围（可多选）</div>
                        ${timeRangeCheckboxes}
                    </div>
                </div>
                <div class="tm-prompt-buttons">
                    <button class="tm-prompt-btn tm-prompt-btn-secondary" id="tm-cancel-quadrant-rule">取消</button>
                    <button class="tm-prompt-btn tm-prompt-btn-primary" id="tm-save-quadrant-rule">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const __quadrantRuleUnstack = __tmModalStackBind(() => modal.remove());

        document.getElementById('tm-cancel-quadrant-rule').onclick = function() {
            __quadrantRuleUnstack?.();
            modal.remove();
        };

        document.getElementById('tm-save-quadrant-rule').onclick = async function() {
            const selectedImportance = Array.from(modal.querySelectorAll('[data-quadrant-importance]:checked')).map(cb => cb.value);
            const selectedTimeRanges = Array.from(modal.querySelectorAll('[data-quadrant-timerange]:checked')).map(cb => cb.value);

            if (selectedImportance.length === 0) {
                hint('⚠ 请至少选择一个重要性条件', 'warning');
                return;
            }

            if (selectedTimeRanges.length === 0) {
                hint('⚠ 请至少选择一个时间范围条件', 'warning');
                return;
            }

            rules[index].importance = selectedImportance;
            rules[index].timeRanges = selectedTimeRanges;

            SettingsStore.data.quadrantConfig = quadrantConfig;
            await SettingsStore.save();

            __quadrantRuleUnstack?.();
            modal.remove();
            hint('✅ 四象限规则已更新', 'success');
            showSettings();
        };
    };

    // 重置四象限规则
    window.tmResetQuadrantRule = async function(index) {
        const defaultRules = [
            { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['beyond7days', 'nodate'] },
            { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['beyond7days', 'nodate'] }
        ];

        const quadrantConfig = SettingsStore.data.quadrantConfig || { enabled: false, rules: defaultRules };
        const rules = quadrantConfig.rules || [];

        if (rules[index]) {
            rules[index] = { ...defaultRules[index] };
            SettingsStore.data.quadrantConfig = quadrantConfig;
            await SettingsStore.save();
            hint('✅ 已重置为默认值', 'success');
            showSettings();
        }
    };

    window.tmSetPriorityBase = function(value) {
        if (!state.priorityScoreDraft) return;
        state.priorityScoreDraft.base = Number(value) || 0;
    };
    window.tmSetPriorityWeight = function(key, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.weights) state.priorityScoreDraft.weights = {};
        state.priorityScoreDraft.weights[key] = Number(value) || 0;
    };
    window.tmSetPriorityDurationUnit = function(value) {
        if (!state.priorityScoreDraft) return;
        const v = String(value || '').trim();
        state.priorityScoreDraft.durationUnit = (v === 'hours' || v === 'minutes') ? v : 'minutes';
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityImportance = function(key, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.importanceDelta) state.priorityScoreDraft.importanceDelta = {};
        state.priorityScoreDraft.importanceDelta[key] = Number(value) || 0;
    };
    window.tmSetPriorityStatus = function(statusId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.statusDelta) state.priorityScoreDraft.statusDelta = {};
        state.priorityScoreDraft.statusDelta[statusId] = Number(value) || 0;
    };
    window.tmAddPriorityDueRange = function() {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) state.priorityScoreDraft.dueRanges = [];
        state.priorityScoreDraft.dueRanges.push({ days: 7, delta: 0 });
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDueRange = function(index) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) return;
        state.priorityScoreDraft.dueRanges.splice(index, 1);
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDueRange = function(index, field, value) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.dueRanges)) return;
        const row = state.priorityScoreDraft.dueRanges[index];
        if (!row) return;
        row[field] = Number(value) || 0;
    };
    window.tmAddPriorityDurationBucket = function() {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) state.priorityScoreDraft.durationBuckets = [];
        state.priorityScoreDraft.durationBuckets.push({ maxMinutes: 60, delta: 0 });
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDurationBucket = function(index) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) return;
        state.priorityScoreDraft.durationBuckets.splice(index, 1);
        __tmRerenderPriorityScoreSettings();
    };
    window.tmSetPriorityDurationBucket = function(index, field, value) {
        if (!state.priorityScoreDraft) return;
        if (!Array.isArray(state.priorityScoreDraft.durationBuckets)) return;
        const row = state.priorityScoreDraft.durationBuckets[index];
        if (!row) return;
        if (field === 'maxMinutes') {
            const unit = state.priorityScoreDraft.durationUnit === 'hours' ? 'hours' : 'minutes';
            const n = Number(value);
            if (!Number.isFinite(n)) {
                row.maxMinutes = 0;
            } else {
                const mins = unit === 'hours' ? (n * 60) : n;
                row.maxMinutes = Math.max(0, mins);
            }
        } else {
            row[field] = Number(value) || 0;
        }
    };
    window.tmAddPriorityDocDelta = function() {
        if (!state.priorityScoreDraft) return;
        state.priorityDocDeltaMode = 'add';
        state.priorityDocDeltaFromDocId = '';
        window.tmPickPriorityDocDelta?.('');
    };
    window.tmSetPriorityDocDelta = function(docId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
        state.priorityScoreDraft.docDeltas[docId] = Number(value) || 0;
        // 不再调用 __tmRerenderPriorityScoreSettings()，避免重新渲染导致输入框失去焦点
        // 数据已保存在 state.priorityScoreDraft 中，用户点击"应用修改"或"保存"时会持久化
    };
    window.tmUpdatePriorityDocDelta = function(oldDocId, newDocId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.docDeltas && typeof state.priorityScoreDraft.docDeltas === 'object') ? state.priorityScoreDraft.docDeltas : {};
        const from = String(oldDocId || '').trim();
        const to = String(newDocId || '').trim();
        if (!from || !to || from === to) return;
        const val = Number(map[from] ?? 0) || 0;
        delete map[from];
        if (map[to] === undefined) map[to] = val;
        state.priorityScoreDraft.docDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityDocDelta = function(docId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.docDeltas && typeof state.priorityScoreDraft.docDeltas === 'object') ? state.priorityScoreDraft.docDeltas : {};
        delete map[docId];
        state.priorityScoreDraft.docDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };

    window.tmAddPriorityGroupDelta = function() {
        if (!state.priorityScoreDraft) return;
        state.priorityGroupDeltaMode = 'add';
        state.priorityGroupDeltaFromGroupId = '';
        window.tmPickPriorityGroupDelta?.('');
    };
    window.tmSetPriorityGroupDelta = function(groupId, value) {
        if (!state.priorityScoreDraft) return;
        if (!state.priorityScoreDraft.groupDeltas || typeof state.priorityScoreDraft.groupDeltas !== 'object') state.priorityScoreDraft.groupDeltas = {};
        state.priorityScoreDraft.groupDeltas[groupId] = Number(value) || 0;
    };
    window.tmUpdatePriorityGroupDelta = function(oldGroupId, newGroupId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.groupDeltas && typeof state.priorityScoreDraft.groupDeltas === 'object') ? state.priorityScoreDraft.groupDeltas : {};
        const from = String(oldGroupId || '').trim();
        const to = String(newGroupId || '').trim();
        if (!from || !to || from === to) return;
        const val = Number(map[from] ?? 0) || 0;
        delete map[from];
        if (map[to] === undefined) map[to] = val;
        state.priorityScoreDraft.groupDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };
    window.tmRemovePriorityGroupDelta = function(groupId) {
        if (!state.priorityScoreDraft) return;
        const map = (state.priorityScoreDraft.groupDeltas && typeof state.priorityScoreDraft.groupDeltas === 'object') ? state.priorityScoreDraft.groupDeltas : {};
        delete map[groupId];
        state.priorityScoreDraft.groupDeltas = map;
        __tmRerenderPriorityScoreSettings();
    };

    window.tmClosePriorityDocDeltaPicker = function() {
        state.__priorityDocDeltaPickerUnstack?.();
        state.__priorityDocDeltaPickerUnstack = null;
        if (state.priorityDocDeltaPicker) {
            try { state.priorityDocDeltaPicker.remove(); } catch (e) {}
            state.priorityDocDeltaPicker = null;
        }
    };

    window.tmClosePriorityGroupDeltaPicker = function() {
        state.__priorityGroupDeltaPickerUnstack?.();
        state.__priorityGroupDeltaPickerUnstack = null;
        if (state.priorityGroupDeltaPicker) {
            try { state.priorityGroupDeltaPicker.remove(); } catch (e) {}
            state.priorityGroupDeltaPicker = null;
        }
    };

    window.tmPriorityDocDeltaSelectDoc = function(docId) {
        const to = String(docId || '').trim();
        if (!to) return;
        const mode = String(state.priorityDocDeltaMode || 'replace');
        if (mode === 'add') {
            if (!state.priorityScoreDraft) return;
            if (!state.priorityScoreDraft.docDeltas || typeof state.priorityScoreDraft.docDeltas !== 'object') state.priorityScoreDraft.docDeltas = {};
            if (state.priorityScoreDraft.docDeltas[to] === undefined) state.priorityScoreDraft.docDeltas[to] = 0;
            __tmRerenderPriorityScoreSettings();
        } else {
            const from = String(state.priorityDocDeltaFromDocId || '').trim();
            if (!from || from === to) return;
            try { window.tmUpdatePriorityDocDelta?.(from, to); } catch (e) {}
        }
        state.priorityDocDeltaFromDocId = '';
        state.priorityDocDeltaMode = '';
        window.tmClosePriorityDocDeltaPicker?.();
    };

    window.tmPriorityGroupDeltaSelectGroup = function(groupId) {
        const to = String(groupId || '').trim();
        if (!to) return;
        const mode = String(state.priorityGroupDeltaMode || 'replace');
        if (mode === 'add') {
            if (!state.priorityScoreDraft) return;
            if (!state.priorityScoreDraft.groupDeltas || typeof state.priorityScoreDraft.groupDeltas !== 'object') state.priorityScoreDraft.groupDeltas = {};
            if (state.priorityScoreDraft.groupDeltas[to] === undefined) state.priorityScoreDraft.groupDeltas[to] = 0;
            __tmRerenderPriorityScoreSettings();
        } else {
            const from = String(state.priorityGroupDeltaFromGroupId || '').trim();
            if (!from || from === to) return;
            try { window.tmUpdatePriorityGroupDelta?.(from, to); } catch (e) {}
        }
        state.priorityGroupDeltaFromGroupId = '';
        state.priorityGroupDeltaMode = '';
        window.tmClosePriorityGroupDeltaPicker?.();
    };

    window.tmPickPriorityDocDelta = async function(oldDocId) {
        if (!state.priorityScoreDraft) return;
        window.tmClosePriorityDocDeltaPicker?.();

        const docs = state.allDocuments || [];
        const groups = SettingsStore.data.docGroups || [];
        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            const found = docs.find(d => d.id === docId);
            if (found) return found.name || '未命名文档';
            const entry = state.taskTree?.find?.(d => d.id === docId);
            return entry?.name || '未命名文档';
        };

        const selected = String(oldDocId || '').trim();
        state.priorityDocDeltaFromDocId = selected;
        state.priorityDocDeltaMode = selected ? 'replace' : 'add';

        const picker = document.createElement('div');
        picker.className = 'tm-quick-add-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档</div>
                <div id="tmPriorityDocDeltaList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" onclick="tmClosePriorityDocDeltaPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.priorityDocDeltaPicker = picker;
        state.__priorityDocDeltaPickerUnstack = __tmModalStackBind(() => window.tmClosePriorityDocDeltaPicker?.());

        const listEl = picker.querySelector('#tmPriorityDocDeltaList');

        const renderGroup = (label, docs0, groupKey, initialOpen = false) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--tm-header-bg);cursor:pointer;';
            head.innerHTML = `<div style="font-weight:600;">${esc(label)}</div><div style="opacity:0.75;">${initialOpen ? '▾' : '▸'}</div>`;
            const body = document.createElement('div');
            body.style.cssText = `padding:6px 10px;display:${initialOpen ? 'block' : 'none'};`;

            const renderDocs = (docList) => {
                body.innerHTML = '';
                if (!docList || docList.length === 0) {
                    body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档</div>';
                    return;
                }
                docList.forEach(d => {
                    const id = String(d?.id || d || '').trim();
                    if (!id) return;
                    const row = document.createElement('div');
                    const checked = id === selected;
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
                    row.innerHTML = `<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(resolveDocName(id))}</div><div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>`;
                    row.onclick = () => window.tmPriorityDocDeltaSelectDoc?.(id);
                    body.appendChild(row);
                });
            };

            if (initialOpen) renderDocs(docs0);

            head.onclick = async () => {
                const open = body.style.display !== 'none';
                if (!open) {
                    body.style.display = 'block';
                    head.lastElementChild.textContent = '▾';
                    if (groupKey) {
                        body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">🔄 加载文档中...</div>';
                        try {
                            const allSet = new Set();
                            const entries = Array.isArray(docs0) ? docs0 : [];
                            await Promise.all(entries.map(async (d) => {
                                const id = String(d?.id || d || '').trim();
                                if (!id) return;
                                allSet.add(id);
                                const rec = !!(typeof d === 'object' && d && d.recursive);
                                if (rec) {
                                    try {
                                        const subIds = await API.getSubDocIds(id);
                                        (subIds || []).forEach(sid => {
                                            const s = String(sid || '').trim();
                                            if (s) allSet.add(s);
                                        });
                                    } catch (e) {}
                                }
                            }));
                            const allIds = Array.from(allSet);

                            const tasksMap = new Map();
                            const taskTreeDocMap = new Map((Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => [String(doc?.id || '').trim(), doc]));
                            allIds.forEach(id => {
                                const treeDoc = taskTreeDocMap.get(String(id || '').trim());
                                if (treeDoc && treeDoc.tasks && treeDoc.tasks.length > 0) tasksMap.set(id, true);
                            });

                            await __tmFillDocHasTasksMap(allIds, tasksMap);

                            const docList = allIds.map(id => ({ id, hasTasks: tasksMap.has(id) })).filter(item => item.hasTasks);
                            docList.sort((a, b) => resolveDocName(a.id).localeCompare(resolveDocName(b.id)));
                            renderDocs(docList);
                        } catch (e) {
                            renderDocs(docs0);
                        }
                    } else {
                        renderDocs(docs0);
                    }
                } else {
                    body.style.display = 'none';
                    head.lastElementChild.textContent = '▸';
                }
            };

            wrap.appendChild(head);
            wrap.appendChild(body);
            return wrap;
        };

        groups.forEach(g => {
            const ds = __tmGetGroupSourceEntries(g);
            if (ds.length === 0) return;
            listEl.appendChild(renderGroup(__tmResolveDocGroupName(g), ds, String(g?.id || '')));
        });
    };

    window.tmPickPriorityGroupDelta = async function(oldGroupId) {
        if (!state.priorityScoreDraft) return;
        window.tmClosePriorityGroupDeltaPicker?.();

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const selected = String(oldGroupId || '').trim();
        state.priorityGroupDeltaFromGroupId = selected;
        state.priorityGroupDeltaMode = selected ? 'replace' : 'add';

        const picker = document.createElement('div');
        picker.className = 'tm-quick-add-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档分组</div>
                <div id="tmPriorityGroupDeltaList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" onclick="tmClosePriorityGroupDeltaPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.priorityGroupDeltaPicker = picker;
        state.__priorityGroupDeltaPickerUnstack = __tmModalStackBind(() => window.tmClosePriorityGroupDeltaPicker?.());

        const listEl = picker.querySelector('#tmPriorityGroupDeltaList');
        if (!listEl) return;
        if (groups.length === 0) {
            listEl.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档分组，请先到文档分组与管理中添加分组。</div>';
            return;
        }

        groups.forEach((group) => {
            const gid = String(group?.id || '').trim();
            if (!gid) return;
            const checked = gid === selected;
            const entryCount = __tmGetGroupSourceEntries(group).length;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;cursor:pointer;border-bottom:1px solid var(--tm-border-color);';
            row.innerHTML = `
                <div style="min-width:0;">
                    <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(__tmResolveDocGroupName(group))}</div>
                    <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:2px;">${entryCount > 0 ? `来源项 ${entryCount} 个` : '空分组'}</div>
                </div>
                <div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>
            `;
            row.onclick = () => window.tmPriorityGroupDeltaSelectGroup?.(gid);
            listEl.appendChild(row);
        });
    };

    function __tmRerenderRulesManagerUI(scope) {
        const html = renderRulesList();
        if (state.rulesModal) {
            if (scope === 'conditions') {
                const el = state.rulesModal.querySelector('.tm-rule-conditions');
                if (el && state.editingRule) el.innerHTML = renderConditions(state.editingRule.conditions);
            } else if (scope === 'sort') {
                const el = state.rulesModal.querySelector('.tm-rule-sort-items');
                if (el && state.editingRule) el.innerHTML = renderSortRules(state.editingRule.sort);
            } else {
                const el = state.rulesModal.querySelector('.tm-rules-body');
                if (el) el.innerHTML = html;
            }
        }
        if (state.settingsModal) {
            if (scope === 'conditions') {
                const el = state.settingsModal.querySelector('.tm-rule-conditions');
                if (el && state.editingRule) el.innerHTML = renderConditions(state.editingRule.conditions);
            } else if (scope === 'sort') {
                const el = state.settingsModal.querySelector('.tm-rule-sort-items');
                if (el && state.editingRule) el.innerHTML = renderSortRules(state.editingRule.sort);
            } else {
                const el = state.settingsModal.querySelector('#tm-rules-list');
                if (el) el.innerHTML = html;
            }
        }
    }

    window.addNewRule = function() {
        const newRule = RuleManager.createRule('新规则');
        state.editingRule = newRule;
        __tmRerenderRulesManagerUI();
    };

    window.editRule = function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            state.editingRule = JSON.parse(JSON.stringify(rule));
            __tmRerenderRulesManagerUI();
        }
    };

    window.cancelEditRule = function() {
        state.editingRule = null;
        __tmRerenderRulesManagerUI();
    };

    window.saveEditRule = async function() {
        if (!state.editingRule) return;
        const savedRuleId = String(state.editingRule.id || '').trim();

        try {
            const fields = RuleManager.getAvailableFields();
            (state.editingRule.conditions || []).forEach(c => {
                const fieldInfo = fields.find(f => f.value === c.field);
                if (!fieldInfo || fieldInfo.type !== 'boolean') return;
                if (c.value === '' || c.value === null || typeof c.value === 'undefined') c.value = 'true';
            });
        } catch (e) {}

        const index = state.filterRules.findIndex(r => r.id === state.editingRule.id);
        if (index >= 0) {
            state.filterRules[index] = state.editingRule;
        } else {
            state.filterRules.push(state.editingRule);
        }

        state.editingRule = null;
        try { await RuleManager.saveRules(state.filterRules); } catch (e) {}
        __tmRerenderRulesManagerUI();
        if (savedRuleId && String(state.currentRule || '').trim() === savedRuleId) {
            const prevDoneOnly = !!state.__tmQueryDoneOnly;
            const nextRule = state.filterRules.find(r => r.id === savedRuleId);
            const nextDoneOnly = !!(nextRule && nextRule.conditions && nextRule.conditions.some(c => c && c.field === 'done' && c.operator === '=' && (c.value === true || String(c.value) === 'true' || c.value === '')));
            state.__tmQueryDoneOnly = nextDoneOnly;
            if (prevDoneOnly !== nextDoneOnly) {
                await loadSelectedDocuments();
                hint('✅ 规则已保存', 'success');
                return;
            }
            __tmScheduleRender({ withFilters: true });
        }
        hint('✅ 规则已保存', 'success');
    };

    window.updateEditingRuleName = function(name) {
        if (state.editingRule) {
            state.editingRule.name = name;
        }
    };

    window.addCondition = function() {
        if (!state.editingRule) return;

        const availableFields = RuleManager.getAvailableFields();
        const firstField = availableFields[0];
        const operators = RuleManager.getOperators(firstField.type);

        state.editingRule.conditions.push({
            field: firstField.value,
            operator: operators[0].value,
            value: ''
        });

        __tmRerenderRulesManagerUI('conditions');
    };

    window.updateConditionField = function(index, field) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            const condition = state.editingRule.conditions[index];
            condition.field = field;
            // 重置操作符和值为新字段的默认值
            const fieldInfo = RuleManager.getFieldInfo(field);
            const operators = RuleManager.getOperators(fieldInfo?.type || 'text');
            condition.operator = operators[0].value;
            condition.value = (fieldInfo?.type === 'boolean') ? 'true' : '';
            if (fieldInfo?.multi && (condition.operator === 'in' || condition.operator === 'not_in')) {
                condition.matchMode = 'any';
            } else {
                delete condition.matchMode;
            }

            if (state.rulesModal) {
                const conditionsDiv = state.rulesModal.querySelector('.tm-rule-conditions');
                conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
            if (state.settingsModal) {
                const conditionsDiv = state.settingsModal.querySelector('.tm-rule-conditions');
                if (conditionsDiv) conditionsDiv.innerHTML = renderConditions(state.editingRule.conditions);
            }
        }
    };

    window.updateConditionOperator = function(index, operator) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            const condition = state.editingRule.conditions[index];
            condition.operator = operator;
            const fieldInfo = RuleManager.getFieldInfo(condition.field);

            // 如果操作符变为 between，初始化值对象
            if (operator === 'between') {
                condition.value = { from: '', to: '' };
            }
            // 如果操作符变为 in/not_in，初始化为数组
            else if (operator === 'in' || operator === 'not_in') {
                if (fieldInfo?.type === 'select') {
                    // 初始化为所有选项都选中，或者根据当前单值转换
                    const currentValue = condition.value;
                    if (typeof currentValue === 'string' && currentValue && !currentValue.includes(',')) {
                        condition.value = [currentValue];
                    } else if (!Array.isArray(currentValue)) {
                        condition.value = [...(fieldInfo.options || [])];
                    }
                }
                if (fieldInfo?.multi) {
                    condition.matchMode = condition.matchMode === 'all' ? 'all' : 'any';
                } else {
                    delete condition.matchMode;
                }
            }
            // 如果操作符从 in/not_in 变为其他，重置为单值
            else {
                if (fieldInfo?.type === 'select' && Array.isArray(condition.value)) {
                    // 取第一个值或空
                    condition.value = condition.value[0] || '';
                }
                delete condition.matchMode;
            }

            // 立即重新渲染条件区域，以更新值输入框的类型
            __tmRerenderRulesManagerUI('conditions');
        }
    };

    window.updateConditionValue = function(index, value) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            state.editingRule.conditions[index].value = value;
        }
    };

    // 切换多值选择的选项
    window.toggleConditionMultiValue = function(index, optionValue, isChecked) {
        if (!state.editingRule || !state.editingRule.conditions[index]) return;

        const condition = state.editingRule.conditions[index];
        let currentValues = [];

        if (Array.isArray(condition.value)) {
            currentValues = [...condition.value];
        } else if (typeof condition.value === 'string' && condition.value.includes(',')) {
            currentValues = condition.value.split(',').map(v => v.trim());
        }

        if (isChecked) {
            if (!currentValues.includes(optionValue)) {
                currentValues.push(optionValue);
            }
        } else {
            currentValues = currentValues.filter(v => v !== optionValue);
        }

        condition.value = currentValues;
    };

    window.updateConditionMatchMode = function(index, mode) {
        if (!state.editingRule || !state.editingRule.conditions[index]) return;
        const condition = state.editingRule.conditions[index];
        const fieldInfo = RuleManager.getFieldInfo(condition.field);
        if (!fieldInfo?.multi) {
            delete condition.matchMode;
            return;
        }
        condition.matchMode = String(mode || '').trim() === 'all' ? 'all' : 'any';
    };

    window.updateConditionValueRange = function(index, key, value) {
        if (state.editingRule && state.editingRule.conditions[index]) {
            if (!state.editingRule.conditions[index].value || typeof state.editingRule.conditions[index].value !== 'object') {
                state.editingRule.conditions[index].value = { from: '', to: '' };
            }
            state.editingRule.conditions[index].value[key] = value;
        }
    };

    window.removeCondition = function(index) {
        if (state.editingRule) {
            state.editingRule.conditions.splice(index, 1);
            __tmRerenderRulesManagerUI('conditions');
        }
    };

    window.addSortRule = function() {
        if (!state.editingRule) return;

        state.editingRule.sort.push({
            field: 'priority',
            order: 'desc'
        });

        __tmRerenderRulesManagerUI('sort');
    };

    window.updateSortField = function(index, field) {
        if (state.editingRule && state.editingRule.sort[index]) {
            state.editingRule.sort[index].field = field;
        }
    };

    window.updateSortOrder = function(index, order) {
        if (state.editingRule && state.editingRule.sort[index]) {
            state.editingRule.sort[index].order = order;
        }
    };

    window.removeSortRule = function(index) {
        if (state.editingRule) {
            state.editingRule.sort.splice(index, 1);
            __tmRerenderRulesManagerUI('sort');
        }
    };

    window.moveSortRule = function(index, delta) {
        if (!state.editingRule) return;
        const list = state.editingRule.sort || [];
        const from = Number(index);
        const d = Number(delta);
        const to = from + d;
        if (!Number.isInteger(from) || !Number.isInteger(to)) return;
        if (from < 0 || from >= list.length) return;
        if (to < 0 || to >= list.length) return;
        const tmp = list[from];
        list[from] = list[to];
        list[to] = tmp;
        state.editingRule.sort = list;
        __tmRerenderRulesManagerUI('sort');
    };

    window.toggleRuleEnabled = function(ruleId, enabled) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
            try {
                SettingsStore.data.filterRules = state.filterRules;
                SettingsStore.save();
            } catch (e) {}
        }
    };

    window.deleteRule = function(ruleId) {
        if (!confirm('确定要删除这个规则吗？')) return;

        const index = state.filterRules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            state.filterRules.splice(index, 1);
            if (state.currentRule === ruleId) {
                state.currentRule = null;
            }
            try {
                SettingsStore.data.filterRules = state.filterRules;
                if (SettingsStore.data.currentRule === ruleId) SettingsStore.data.currentRule = null;
                SettingsStore.save();
            } catch (e) {}
            __tmRerenderRulesManagerUI();
            hint('✅ 规则已删除', 'success');
        }
    };

    window.applyRuleNow = async function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (rule) {
            const prevDoneOnly = !!state.__tmQueryDoneOnly;
            const prevCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
            state.currentRule = ruleId;
            SettingsStore.data.currentRule = ruleId;
            __tmPersistGlobalViewProfileFromCurrentState();
            const nextDoneOnly = __tmRuleNeedsDoneOnly(rule);
            state.__tmQueryDoneOnly = nextDoneOnly;
            const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({ rule });
            await SettingsStore.save();
            closeRulesManager();
            if (prevDoneOnly !== nextDoneOnly || __tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
                await loadSelectedDocuments({
                    source: 'apply-rule-now',
                });
            } else {
                try {
                    await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                        hydrateVisible: false,
                    });
                } catch (e) {}
                __tmScheduleRender({ withFilters: true });
            }
            hint(`✅ 已应用规则: ${rule.name}`, 'success');
        }
    };

    window.closeRulesManager = function() {
        state.__priorityUnstack?.();
        state.__priorityUnstack = null;
        state.__rulesUnstack?.();
        state.__rulesUnstack = null;
        if (state.rulesModal) {
            state.rulesModal.remove();
            state.rulesModal = null;
        }
        if (state.priorityModal) {
            state.priorityModal.remove();
            state.priorityModal = null;
        }
    };

    window.saveRules = async function() {
        await RuleManager.saveRules(state.filterRules);
        // 同时保存当前选中的规则
        SettingsStore.data.currentRule = state.currentRule;
        await SettingsStore.save();
        hint('✅ 所有规则已保存', 'success');
        closeRulesManager();
    };

    function __tmIsAllRuleLike(rule) {
        if (!rule || typeof rule !== 'object') return false;
        const id = String(rule.id || '').trim().toLowerCase();
        const name = String(rule.name || '').trim().toLowerCase();
        if (id === 'all' || id === '__all__' || id === 'all_tasks' || id.includes('all')) return true;
        if (name === '全部' || name === 'all' || name === 'all tasks' || name === 'all_tasks' || name.includes('全部')) return true;
        const conds = Array.isArray(rule.conditions) ? rule.conditions.filter(Boolean) : [];
        if (conds.length === 0) return true;
        if (conds.length === 1) {
            const c = conds[0] || {};
            if (String(c.field || '') === 'done' && String(c.operator || '') === '=' && String(c.value) === '__all__') {
                return true;
            }
        }
        return false;
    }

    function __tmGetNormalizedRuleSorts(rule) {
        if (!rule || typeof rule !== 'object') return [];
        return (Array.isArray(rule.sort) ? rule.sort : [])
            .map((item) => (item && typeof item === 'object') ? item : null)
            .filter(Boolean)
            .map((item) => ({
                field: String(item.field || '').trim(),
                order: String(item.order || 'asc').trim() === 'desc' ? 'desc' : 'asc',
            }))
            .filter((item) => !!item.field);
    }

    function __tmRuleHasExplicitSort(rule) {
        return __tmGetNormalizedRuleSorts(rule).length > 0;
    }

    function __tmRuleUsesDocFlowSort(rule) {
        if (!rule || typeof rule !== 'object') return true;
        const sorts = __tmGetNormalizedRuleSorts(rule);
        if (!sorts.length) return true;
        return sorts.length === 1 && String(sorts[0]?.field || '').trim() === 'docSeq';
    }

    function __tmGetCurrentRule() {
        return state.currentRule ? state.filterRules.find((rule) => rule.id === state.currentRule) : null;
    }

    function __tmCanCreateChildTaskByDrag() {
        return !!(
            state.groupByDocName
            || state.groupByTaskName
            || state.groupByTime
            || state.quadrantEnabled
            || (!state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled)
        );
    }

    function __tmCanReorderTasksBeforeAfter(rule = null) {
        const activeRule = (rule && typeof rule === 'object') ? rule : __tmGetCurrentRule();
        if (state.groupByTime || state.groupByTaskName || state.quadrantEnabled) return false;
        const isUngroup = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
        if (!state.groupByDocName && !isUngroup) return false;
        return __tmRuleUsesDocFlowSort(activeRule);
    }

    function __tmGetTaskDropCapabilities(rule = null) {
        const allowSiblingReorder = __tmCanReorderTasksBeforeAfter(rule);
        return {
            before: allowSiblingReorder,
            child: __tmCanCreateChildTaskByDrag(),
            after: allowSiblingReorder,
        };
    }

    // 修改原有的applyFilters函数以支持规则
    function applyFilters() {
        const filterStartTime = Date.now();
        const filterMetrics = {};
        let tasks = [];
        let allTasksForTabs = [];

        state.activeDocId = state.activeDocId || 'all';
        const hasOtherBlocks = Array.isArray(state.otherBlocks) && state.otherBlocks.length > 0;
        if (__tmIsOtherBlockTabId(state.activeDocId) && !hasOtherBlocks) {
            state.activeDocId = 'all';
        }
        const isOtherBlocksActive = __tmIsOtherBlockTabId(state.activeDocId) && hasOtherBlocks;
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';

        const collect = (list, target) => {
            (list || []).forEach((t) => {
                target.push(t);
                if (t.children && t.children.length > 0) {
                    collect(t.children, target);
                }
            });
        };

        state.taskTree.forEach((doc) => {
            const docTasks = [];
            collect(doc.tasks, docTasks);
            allTasksForTabs.push(...docTasks);
            if (isOtherBlocksActive) return;
            if (activeDocId !== 'all' && doc.id !== activeDocId) return;
            tasks.push(...docTasks);
        });
        if (hasOtherBlocks) {
            const otherTasks = [];
            collect(state.otherBlocks, otherTasks);
            allTasksForTabs.push(...otherTasks);
            if (activeDocId === 'all' || isOtherBlocksActive) {
                tasks.push(...otherTasks);
            }
        }

        const taskMap = state.flatTasks || {};
        const hasIncompleteAncestorMemo = new Map();
        const hasIncompleteAncestor = (task) => {
            const tid = String(task?.id || '').trim();
            if (tid && hasIncompleteAncestorMemo.has(tid)) return hasIncompleteAncestorMemo.get(tid);
            let parentId = task?.parentTaskId;
            const seen = new Set();
            while (parentId) {
                if (seen.has(parentId)) break;
                seen.add(parentId);
                const parent = taskMap[parentId];
                if (!parent) {
                    if (tid) hasIncompleteAncestorMemo.set(tid, null);
                    return null;
                }
                if (!parent.done) {
                    if (tid) hasIncompleteAncestorMemo.set(tid, true);
                    return true;
                }
                parentId = parent.parentTaskId;
            }
            if (tid) hasIncompleteAncestorMemo.set(tid, false);
            return false;
        };

        const rule = __tmGetCurrentRule();
        const hasExplicitSortRule = __tmRuleHasExplicitSort(rule);
        const hasRuleConditions = !!(rule && Array.isArray(rule.conditions) && rule.conditions.length > 0);
        const isUngroup = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
        const keepDocFlowOrder = __tmRuleUsesDocFlowSort(rule) && (!!state.groupByDocName || isUngroup);
        const taskScopeMatchesTabs = !isOtherBlocksActive && activeDocId === 'all';
        const ruleRuntime = {
            fieldInfoCache: new Map(),
            valueMemo: new WeakMap(),
            selectValueMemo: new WeakMap(),
            timeValueMemo: new WeakMap(),
            timeSortMemo: new Map(),
        };

        const currentRuleExcludesCompleted = () => {
            if (!rule || !rule.conditions || rule.conditions.length === 0) return false;
            return rule.conditions.some((condition) =>
                condition.field === 'done'
                && condition.operator === '='
                && String(condition.value) === 'false'
            );
        };

        const currentRuleIncludesCompleted = () => {
            if (!rule || !rule.conditions || rule.conditions.length === 0) return false;
            return rule.conditions.some((condition) =>
                condition.field === 'done'
                && condition.operator === '='
                && (condition.value === true || String(condition.value) === 'true' || condition.value === '')
            );
        };

        const currentRuleAllStatuses = () => {
            if (!rule || !rule.conditions || rule.conditions.length === 0) return false;
            return rule.conditions.some((condition) =>
                condition.field === 'done'
                && condition.operator === '='
                && String(condition.value) === '__all__'
            );
        };

        const otherBlocksShowDoneInAllRule = isOtherBlocksActive && (
            !rule
            || !Array.isArray(rule.conditions)
            || rule.conditions.length === 0
            || currentRuleAllStatuses()
        );
        const excludeCompleted = state.excludeCompletedTasks
            && !currentRuleIncludesCompleted()
            && !currentRuleAllStatuses()
            && !otherBlocksShowDoneInAllRule;
        const ruleExcludesCompleted = currentRuleExcludesCompleted();

        const filterVisibleTasks = (list) => (list || []).filter((t) => {
            const ancestorState = t.parentTaskId ? hasIncompleteAncestor(t) : null;
            if (t.parentTaskId && ancestorState === false) return false;
            if (excludeCompleted && t.done && !t.parentTaskId) return false;
            if (excludeCompleted && t.done && t.parentTaskId) {
                if (!ruleExcludesCompleted) return true;
                return false;
            }
            return true;
        });

        const visibleFilterStartTime = Date.now();
        const tasksForTabs = filterVisibleTasks(allTasksForTabs);
        tasks = taskScopeMatchesTabs ? tasksForTabs : filterVisibleTasks(tasks);
        filterMetrics.visibleMs = __tmRoundPerfMs(Date.now() - visibleFilterStartTime);
        filterMetrics.visibleTaskCount = Array.isArray(tasks) ? tasks.length : 0;
        filterMetrics.visibleTabTaskCount = Array.isArray(tasksForTabs) ? tasksForTabs.length : 0;

        const ruleFilterStartTime = Date.now();
        let matchedForTabs = tasksForTabs;
        let matched = taskScopeMatchesTabs ? matchedForTabs : tasks;
        if (hasRuleConditions) {
            matchedForTabs = RuleManager.applyRuleFilter(matchedForTabs, rule, ruleRuntime);
            matched = taskScopeMatchesTabs ? matchedForTabs : RuleManager.applyRuleFilter(matched, rule, ruleRuntime);
        }
        filterMetrics.ruleMs = __tmRoundPerfMs(Date.now() - ruleFilterStartTime);

        const searchFilterStartTime = Date.now();
        if (state.searchKeyword) {
            const keyword = state.searchKeyword.toLowerCase();
            matchedForTabs = matchedForTabs.filter((task) => String(task.content || '').toLowerCase().includes(keyword));
            matched = taskScopeMatchesTabs ? matchedForTabs : matched.filter((task) => String(task.content || '').toLowerCase().includes(keyword));
        }
        filterMetrics.searchMs = __tmRoundPerfMs(Date.now() - searchFilterStartTime);
        filterMetrics.matchedTaskCount = Array.isArray(matched) ? matched.length : 0;
        filterMetrics.matchedTabTaskCount = Array.isArray(matchedForTabs) ? matchedForTabs.length : 0;

        const matchedSet = new Set();
        matched.forEach((t) => matchedSet.add(t.id));

        const filteredDocIdsForTabs = new Set();
        const loadedDocIdSet = new Set((Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => String(doc?.id || '').trim()).filter(Boolean));
        matchedForTabs.forEach((task) => {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId && loadedDocIdSet.has(docId)) filteredDocIdsForTabs.add(docId);
        });

        const buildAncestorSet = (list) => {
            const out = new Set();
            try {
                (list || []).forEach((t) => {
                    let parentId = t?.parentTaskId;
                    const seen = new Set();
                    while (parentId) {
                        if (seen.has(parentId)) break;
                        seen.add(parentId);
                        const p = taskMap[parentId];
                        if (!p) break;
                        out.add(p.id);
                        parentId = p.parentTaskId;
                    }
                });
            } catch (e) {}
            return out;
        };
        const ancestorBuildStartTime = Date.now();
        const ancestorSet = buildAncestorSet(matched);
        filterMetrics.ancestorMs = __tmRoundPerfMs(Date.now() - ancestorBuildStartTime);
        filterMetrics.ancestorCount = ancestorSet.size;

        const stablePinnedFirst = (list) => {
            const source = Array.isArray(list) ? list : [];
            if (source.length <= 1) return source;
            const pinned = [];
            const rest = [];
            let hasPinned = false;
            let hasUnpinned = false;
            source.forEach((task) => {
                if (task?.pinned) {
                    hasPinned = true;
                    pinned.push(task);
                } else {
                    hasUnpinned = true;
                    rest.push(task);
                }
            });
            if (!hasPinned || !hasUnpinned) return source;
            return pinned.concat(rest);
        };

        const siblingSortCache = new WeakMap();
        const sortSiblings = (list) => {
            const source = Array.isArray(list) ? list : [];
            if (source.length <= 1) return source;
            const cached = siblingSortCache.get(source);
            if (Array.isArray(cached)) return cached;
            let next;
            if (keepDocFlowOrder) {
                next = source;
            } else if (!hasExplicitSortRule) {
                next = stablePinnedFirst(source);
            } else {
                next = RuleManager.applyRuleSort(source, rule, ruleRuntime);
            }
            siblingSortCache.set(source, next);
            return next;
        };

        const applyWhiteboardSequenceFilterWithPerf = (list) => {
            const sequenceStartTime = Date.now();
            const next = __tmApplyWhiteboardSequenceFilter(list);
            filterMetrics.sequenceMs = __tmRoundPerfMs(Number(filterMetrics.sequenceMs || 0) + (Date.now() - sequenceStartTime));
            return next;
        };

        const ordered = [];
        const added = new Set();
        const traverse = (list, ancestorMatched = false) => {
            const siblings = sortSiblings(list);
            siblings.forEach((t) => {
                if (!t) return;
                const isMatched = matchedSet.has(t.id);
                const isAncestor = ancestorSet.has(t.id);
                const show = isMatched || isAncestor || ancestorMatched;
                if (show && !added.has(t.id)) {
                    added.add(t.id);
                    ordered.push(t);
                }
                if (t.children && t.children.length > 0) {
                    traverse(t.children, ancestorMatched || isMatched);
                }
            });
        };

        const orderStartTime = Date.now();

        if (isOtherBlocksActive) {
            const orderedOtherBlocks = hasExplicitSortRule
                ? RuleManager.applyRuleSort(matched, rule, ruleRuntime)
                : matched.slice();
            const finalOrdered = applyWhiteboardSequenceFilterWithPerf(orderedOtherBlocks);
            state.filteredTasks = finalOrdered;
            state.filteredDocIdsForTabs = Array.from(filteredDocIdsForTabs);
            filterMetrics.orderMs = __tmRoundPerfMs(Date.now() - orderStartTime);
            filterMetrics.orderedCount = Array.isArray(finalOrdered) ? finalOrdered.length : 0;
            filterMetrics.totalMs = __tmRoundPerfMs(Date.now() - filterStartTime);
            state.__tmLastFilterPerf = filterMetrics;
            try {
                const total = Array.isArray(finalOrdered) ? finalOrdered.length : 0;
                const firstId = total > 0 ? String(finalOrdered[0]?.id || '').trim() : '';
                const lastId = total > 0 ? String(finalOrdered[total - 1]?.id || '').trim() : '';
                const signature = [
                    String(state.activeDocId || 'all').trim() || 'all',
                    String(state.currentRule || '').trim(),
                    String(state.searchKeyword || '').trim(),
                    String(state.groupByDocName ? 1 : 0),
                    String(state.groupByTaskName ? 1 : 0),
                    String(state.groupByTime ? 1 : 0),
                    String(state.quadrantEnabled ? 1 : 0),
                    String(total),
                    firstId,
                    lastId
                ].join('|');
                const step = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
                if (String(state.listRenderSignature || '') !== signature) {
                    state.listRenderSignature = signature;
                    state.listRenderLimit = step;
                } else {
                    state.listRenderLimit = Math.max(step, Number(state.listRenderLimit) || step);
                }
            } catch (e) {}
            try { window.dispatchEvent(new CustomEvent('tm:filtered-tasks-updated')); } catch (e) {}
            return;
        }

        if (activeDocId === 'all') {
            const allScopeStartTime = Date.now();
            const visibleAllTasks = [];
            for (let i = 0; i < allTasksForTabs.length; i += 1) {
                const task = allTasksForTabs[i];
                const taskId = String(task?.id || '').trim();
                if (!taskId) continue;
                if (matchedSet.has(taskId) || ancestorSet.has(taskId)) {
                    visibleAllTasks.push(task);
                }
            }
            const sortedVisibleTasks = keepDocFlowOrder
                ? visibleAllTasks.slice()
                : (!hasExplicitSortRule
                    ? stablePinnedFirst(visibleAllTasks)
                    : RuleManager.applyRuleSort(visibleAllTasks, rule, ruleRuntime));
            filterMetrics.allScopeMs = __tmRoundPerfMs(Date.now() - allScopeStartTime);
            ordered.push(...sortedVisibleTasks);
        } else {
            state.taskTree.forEach((doc) => {
                if (activeDocId !== 'all' && doc.id !== activeDocId) return;
                traverse(doc.tasks || [], false);
            });
        }

        const finalOrdered = applyWhiteboardSequenceFilterWithPerf(ordered);
        state.filteredTasks = finalOrdered;
        state.filteredDocIdsForTabs = Array.from(filteredDocIdsForTabs);
        filterMetrics.orderMs = __tmRoundPerfMs(Date.now() - orderStartTime);
        filterMetrics.orderedCount = Array.isArray(finalOrdered) ? finalOrdered.length : 0;
        filterMetrics.totalMs = __tmRoundPerfMs(Date.now() - filterStartTime);
        state.__tmLastFilterPerf = filterMetrics;
        try {
            const total = Array.isArray(finalOrdered) ? finalOrdered.length : 0;
            const firstId = total > 0 ? String(finalOrdered[0]?.id || '').trim() : '';
            const lastId = total > 0 ? String(finalOrdered[total - 1]?.id || '').trim() : '';
            const signature = [
                String(state.activeDocId || 'all').trim() || 'all',
                String(state.currentRule || '').trim(),
                String(state.searchKeyword || '').trim(),
                String(state.groupByDocName ? 1 : 0),
                String(state.groupByTaskName ? 1 : 0),
                String(state.groupByTime ? 1 : 0),
                String(state.quadrantEnabled ? 1 : 0),
                String(total),
                firstId,
                lastId
            ].join('|');
            const step = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
            if (String(state.listRenderSignature || '') !== signature) {
                state.listRenderSignature = signature;
                state.listRenderLimit = step;
            } else {
                state.listRenderLimit = Math.max(step, Number(state.listRenderLimit) || step);
            }
        } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('tm:filtered-tasks-updated')); } catch (e) {}
    }

    function __tmIsTaskAndDescDone(taskId, memo, visiting) {
        const id = String(taskId || '').trim();
        if (!id) return true;
        const m = (memo && typeof memo === 'object') ? memo : {};
        if (Object.prototype.hasOwnProperty.call(m, id)) return !!m[id];
        const v = visiting instanceof Set ? visiting : new Set();
        if (v.has(id)) return true;
        v.add(id);
        const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!t) {
            m[id] = true;
            v.delete(id);
            return true;
        }
        if (!t.done) {
            m[id] = false;
            v.delete(id);
            return false;
        }
        const kids = Array.isArray(t.children) ? t.children : [];
        for (const c of kids) {
            const cid = String(c?.id || '').trim();
            if (!cid) continue;
            if (!__tmIsTaskAndDescDone(cid, m, v)) {
                m[id] = false;
                v.delete(id);
                return false;
            }
        }
        m[id] = true;
        v.delete(id);
        return true;
    }

    function __tmIsTaskAndDescDoneForSequence(taskId, memo, visiting, options = {}) {
        const id = String(taskId || '').trim();
        if (!id) return true;
        const m = (memo && typeof memo === 'object') ? memo : {};
        if (Object.prototype.hasOwnProperty.call(m, id)) return !!m[id];
        const v = visiting instanceof Set ? visiting : new Set();
        if (v.has(id)) return true;
        v.add(id);
        const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!t) {
            m[id] = true;
            v.delete(id);
            return true;
        }
        if (!t.done) {
            m[id] = false;
            v.delete(id);
            return false;
        }
        const ignoreChildRoots = (options && options.ignoreChildRoots instanceof Set) ? options.ignoreChildRoots : new Set();
        const kids = Array.isArray(t.children) ? t.children : [];
        for (const c of kids) {
            const cid = String(c?.id || '').trim();
            if (!cid) continue;
            if (ignoreChildRoots.has(cid)) continue;
            if (!__tmIsTaskAndDescDoneForSequence(cid, m, v, options)) {
                m[id] = false;
                v.delete(id);
                return false;
            }
        }
        m[id] = true;
        v.delete(id);
        return true;
    }

    function __tmCollectSequenceDescendants(rootId, allowedSet, excludedChildRoots) {
        const root = String(rootId || '').trim();
        if (!root) return [];
        const allowed = allowedSet instanceof Set ? allowedSet : new Set();
        const excluded = excludedChildRoots instanceof Set ? excludedChildRoots : new Set();
        const out = [];
        const seen = new Set();
        const stack = [];
        const t0 = globalThis.__tmRuntimeState?.getFlatTaskById?.(root) || state.flatTasks?.[root];
        (Array.isArray(t0?.children) ? t0.children : []).forEach((c) => {
            const cid = String(c?.id || '').trim();
            if (cid) stack.push(cid);
        });
        while (stack.length) {
            const id = String(stack.pop() || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            if (excluded.has(id)) continue;
            if (!allowed.has(id)) continue;
            out.push(id);
            const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
            const kids = Array.isArray(t?.children) ? t.children : [];
            kids.forEach((c) => {
                const cid = String(c?.id || '').trim();
                if (cid) stack.push(cid);
            });
        }
        return out;
    }

    function __tmCollectCyclicNodes(nodes, adj) {
        const color = new Map();
        const stack = [];
        const cycleNodes = new Set();
        const markCycleFrom = (startId) => {
            let hit = false;
            for (const sid of stack) {
                if (sid === startId) hit = true;
                if (hit) cycleNodes.add(sid);
            }
            cycleNodes.add(startId);
        };
        const dfs = (u) => {
            color.set(u, 1);
            stack.push(u);
            const outs = Array.isArray(adj.get(u)) ? adj.get(u) : [];
            for (const v of outs) {
                if (!nodes.has(v)) continue;
                const c = Number(color.get(v) || 0);
                if (c === 0) dfs(v);
                else if (c === 1) markCycleFrom(v);
            }
            stack.pop();
            color.set(u, 2);
        };
        nodes.forEach((id) => {
            if (Number(color.get(id) || 0) === 0) dfs(id);
        });
        return cycleNodes;
    }

    function __tmBuildWhiteboardSequenceVisibleTaskSet(candidateTasks) {
        const list = Array.isArray(candidateTasks) ? candidateTasks : [];
        if (!list.length) return null;
        const orderMap = new Map(list.map((t, i) => [String(t?.id || '').trim(), i]));
        const taskIds = Array.from(orderMap.keys()).filter(Boolean);
        if (!taskIds.length) return null;

        const byDoc = new Map();
        taskIds.forEach((id) => {
            const did = String(
                __tmGetTaskDocIdById(id)
                || globalThis.__tmRuntimeState?.getFlatTaskById?.(id)?.docId
                || globalThis.__tmRuntimeState?.getFlatTaskById?.(id)?.root_id
                || state.flatTasks?.[id]?.docId
                || state.flatTasks?.[id]?.root_id
                || ''
            ).trim();
            if (!did) return;
            if (!byDoc.has(did)) byDoc.set(did, new Set());
            byDoc.get(did).add(id);
        });
        if (!byDoc.size) return null;

        const manualLinksRuntime = __tmGetManualTaskLinksRuntime();
        const manualLinksByDoc = manualLinksRuntime.byDoc instanceof Map ? manualLinksRuntime.byDoc : new Map();
        const visible = new Set();

        byDoc.forEach((nodes, docId) => {
            const docLinks = Array.isArray(manualLinksByDoc.get(docId)) ? manualLinksByDoc.get(docId) : [];
            const linkedDetachedChildren = new Set();
            docLinks.forEach((ln) => {
                const from = String(ln?.from || '').trim();
                const to = String(ln?.to || '').trim();
                [from, to].forEach((id) => {
                    if (!id || !nodes.has(id)) return;
                    const pid = String(__tmResolveWhiteboardTaskParentId(id) || '').trim();
                    if (!pid || !nodes.has(pid)) return;
                    if (!__tmIsWhiteboardChildDetached(id)) return;
                    linkedDetachedChildren.add(id);
                });
            });

            const seqNodes = new Set();
            nodes.forEach((id) => {
                const pid = String(__tmResolveWhiteboardTaskParentId(id) || '').trim();
                const hasParentInScope = !!(pid && nodes.has(pid));
                if (!hasParentInScope || linkedDetachedChildren.has(id)) seqNodes.add(id);
            });
            if (!seqNodes.size) return;

            const adj = new Map();
            seqNodes.forEach((id) => {
                adj.set(id, []);
            });
            docLinks.forEach((ln) => {
                const from = String(ln?.from || '').trim();
                const to = String(ln?.to || '').trim();
                if (!from || !to || from === to) return;
                if (!seqNodes.has(from) || !seqNodes.has(to)) return;
                const arr = adj.get(from);
                if (!Array.isArray(arr)) return;
                if (arr.includes(to)) return;
                arr.push(to);
            });

            const addVisibleWithChildren = (id) => {
                const k = String(id || '').trim();
                if (!k) return;
                visible.add(k);
                __tmCollectSequenceDescendants(k, nodes, linkedDetachedChildren).forEach((cid) => visible.add(cid));
            };

            const cyclic = __tmCollectCyclicNodes(seqNodes, adj);
            cyclic.forEach((id) => addVisibleWithChildren(id));

            const dagNodes = new Set(Array.from(seqNodes).filter((id) => !cyclic.has(id)));
            if (!dagNodes.size) return;

            const indeg2 = new Map();
            dagNodes.forEach((id) => indeg2.set(id, 0));
            dagNodes.forEach((from) => {
                const outs = Array.isArray(adj.get(from)) ? adj.get(from) : [];
                outs.forEach((to) => {
                    if (!dagNodes.has(to)) return;
                    indeg2.set(to, Number(indeg2.get(to) || 0) + 1);
                });
            });

            const layers = [];
            const seen = new Set();
            let frontier = Array.from(dagNodes).filter((id) => Number(indeg2.get(id) || 0) === 0);
            while (frontier.length) {
                frontier.sort((a, b) => (orderMap.get(a) ?? 999999) - (orderMap.get(b) ?? 999999));
                layers.push(frontier.slice());
                const next = [];
                frontier.forEach((u) => {
                    seen.add(u);
                    const outs = Array.isArray(adj.get(u)) ? adj.get(u) : [];
                    outs.forEach((v) => {
                        if (!dagNodes.has(v)) return;
                        const nv = Number(indeg2.get(v) || 0) - 1;
                        indeg2.set(v, nv);
                        if (nv === 0) next.push(v);
                    });
                });
                frontier = Array.from(new Set(next));
            }
            const leftovers = Array.from(dagNodes).filter((id) => !seen.has(id));
            if (leftovers.length) {
                leftovers.sort((a, b) => (orderMap.get(a) ?? 999999) - (orderMap.get(b) ?? 999999));
                layers.push(leftovers);
            }
            if (!layers.length) return;

            const doneMemo = {};
            let currentLayerIdx = layers.findIndex((layer) => !layer.every((id) => __tmIsTaskAndDescDoneForSequence(id, doneMemo, new Set(), { ignoreChildRoots: linkedDetachedChildren })));
            if (currentLayerIdx < 0) currentLayerIdx = layers.length - 1;
            (layers[currentLayerIdx] || []).forEach((id) => addVisibleWithChildren(id));
        });

        return visible;
    }

    function __tmApplyWhiteboardSequenceFilter(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        if (!list.length) return list;
        if (state.viewMode === 'whiteboard') return list;
        if (!SettingsStore.data.whiteboardSequenceMode) return list;
        const visibleSet = __tmBuildWhiteboardSequenceVisibleTaskSet(list);
        if (!(visibleSet instanceof Set) || !visibleSet.size) return list;
        return list.filter((t) => visibleSet.has(String(t?.id || '').trim()));
    }

    window.tmSwitchDoc = async function(docId) {
        if (Number(state.suppressDocTabClickUntil || 0) > Date.now()) return;
        const nextDocId = String(docId || 'all').trim() || 'all';
        state.activeDocId = (__tmIsOtherBlockTabId(nextDocId) && !(Array.isArray(state.otherBlocks) && state.otherBlocks.length))
            ? 'all'
            : nextDocId;
        __tmMarkContextInteractionQuiet('switch-doc', 900);
        try { recalcStats(); } catch (e) {}
        const applied = await __tmApplyCurrentContextViewProfile();
        if (applied?.doneOnlyChanged || applied?.customFieldReloadNeeded) await loadSelectedDocuments();
        else __tmScheduleRender({ withFilters: true });
        if (state.viewMode === 'whiteboard') {
            try {
                requestAnimationFrame(() => {
                    try { window.tmWhiteboardResetView?.(); } catch (e) {}
                });
            } catch (e) {}
        }
    };

    window.tmSaveCurrentViewProfileToGroup = async function(groupId) {
        const gid = String(groupId || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const store = __tmGetViewProfilesStore();
        store.groups[gid] = __tmGetCurrentUiViewProfile();
        SettingsStore.data.viewProfiles = store;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        try { hint(`✅ 已保存到${gid === 'all' ? '全部文档' : '当前分组'}默认配置`, 'success'); } catch (e) {}
        render();
    };

    window.tmSaveCurrentViewProfileToDoc = async function(docId) {
        const did = String(docId || state.activeDocId || '').trim();
        if (!did || did === 'all') {
            try { hint('ℹ 请先进入具体文档页签后再保存页签配置', 'info'); } catch (e) {}
            return;
        }
        const store = __tmGetViewProfilesStore();
        store.docs[did] = __tmGetCurrentUiViewProfile();
        SettingsStore.data.viewProfiles = store;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        try { hint('✅ 已保存到当前页签配置', 'success'); } catch (e) {}
        render();
    };

    window.tmClearViewProfile = async function(scope, id) {
        const kind = String(scope || '').trim();
        const store = __tmGetViewProfilesStore();
        let changed = false;
        let affectsCurrent = false;
        if (kind === 'doc') {
            const did = String(id || state.activeDocId || '').trim();
            if (!did || did === 'all') return;
            if (store.docs[did]) {
                delete store.docs[did];
                changed = true;
            }
            affectsCurrent = did === String(state.activeDocId || '').trim();
        } else if (kind === 'allTabs') {
            const gid = String(id || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            if (store.allTabs[gid]) {
                delete store.allTabs[gid];
                changed = true;
            }
            affectsCurrent = gid === String(SettingsStore.data.currentGroupId || 'all').trim() && String(state.activeDocId || 'all').trim() === 'all';
        } else if (kind === 'group') {
            const gid = String(id || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            if (store.groups[gid]) {
                delete store.groups[gid];
                changed = true;
            }
            affectsCurrent = gid === String(SettingsStore.data.currentGroupId || 'all').trim();
        } else {
            return;
        }
        if (!changed) return;
        SettingsStore.data.viewProfiles = store;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (affectsCurrent) {
            const applied = await __tmApplyCurrentContextViewProfile();
            if (applied?.doneOnlyChanged || applied?.customFieldReloadNeeded) await loadSelectedDocuments();
            else __tmScheduleRender({ withFilters: true });
        } else {
            render();
        }
        try {
            hint(
                kind === 'doc'
                    ? '✅ 已清除页签自定义'
                    : (kind === 'allTabs' ? '✅ 已清除全部页签专用配置' : '✅ 已清除分组默认配置'),
                'success'
            );
        } catch (e) {}
    };

    function __tmCloseViewProfileConfigModal() {
        try { document.querySelector('.tm-view-profile-config-modal')?.remove?.(); } catch (e) {}
    }

    async function __tmSaveViewProfileConfig(scope, id, profile) {
        const kind = String(scope || '').trim();
        const store = __tmGetViewProfilesStore();
        const nextProfile = __tmNormalizeViewProfile(profile, __tmGetCurrentUiViewProfile());
        let affectsCurrent = false;
        if (kind === 'doc') {
            const did = String(id || state.activeDocId || '').trim();
            if (!did || did === 'all') return;
            store.docs[did] = nextProfile;
            affectsCurrent = did === String(state.activeDocId || '').trim();
        } else if (kind === 'allTabs') {
            const gid = String(id || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            store.allTabs[gid] = nextProfile;
            affectsCurrent = gid === String(SettingsStore.data.currentGroupId || 'all').trim() && String(state.activeDocId || 'all').trim() === 'all';
        } else if (kind === 'group') {
            const gid = String(id || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            store.groups[gid] = nextProfile;
            affectsCurrent = gid === String(SettingsStore.data.currentGroupId || 'all').trim();
        } else {
            return;
        }
        SettingsStore.data.viewProfiles = store;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (affectsCurrent) {
            const applied = await __tmApplyCurrentContextViewProfile();
            if (applied?.doneOnlyChanged || applied?.customFieldReloadNeeded) await loadSelectedDocuments();
            else __tmScheduleRender({ withFilters: true });
        } else {
            render();
        }
        try {
            hint(
                kind === 'doc'
                    ? '✅ 页签配置已保存'
                    : (kind === 'allTabs' ? '✅ 全部页签专用配置已保存' : '✅ 分组默认配置已保存'),
                'success'
            );
        } catch (e) {}
    }

    window.tmOpenViewProfileConfigModal = function(scope, id) {
        const scope0 = String(scope || '').trim();
        const kind = scope0 === 'doc' ? 'doc' : (scope0 === 'allTabs' ? 'allTabs' : 'group');
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const targetId = String(id || (kind === 'doc' ? state.activeDocId : currentGroupId) || '').trim() || currentGroupId;
        if (kind === 'doc' && (!targetId || targetId === 'all')) {
            try { hint('ℹ 请先选择具体文档页签', 'info'); } catch (e) {}
            return;
        }

        const groupName = currentGroupId === 'all'
            ? '全部文档'
            : (__tmResolveDocGroupName((SettingsStore.data.docGroups || []).find((g) => String(g?.id || '').trim() === currentGroupId)) || '当前分组');
        const docName = kind === 'doc'
            ? (__tmIsOtherBlockTabId(targetId)
                ? __TM_OTHER_BLOCK_TAB_NAME
                : __tmGetDocDisplayName(targetId, targetId))
            : '';
        const storedProfile = kind === 'doc'
            ? __tmGetStoredDocViewProfile(targetId)
            : (kind === 'allTabs' ? __tmGetStoredAllTabsViewProfile(targetId) : __tmGetStoredGroupViewProfile(targetId));
        const inheritedProfile = kind === 'doc'
            ? (__tmGetStoredGroupViewProfile(currentGroupId) || __tmGetViewProfilesStore().global)
            : (kind === 'allTabs'
                ? (__tmGetStoredGroupViewProfile(currentGroupId) || __tmGetViewProfilesStore().global)
                : __tmGetViewProfilesStore().global);
        const initialProfile = storedProfile || inheritedProfile || __tmGetCurrentUiViewProfile();
        const mode = __tmNormalizeGroupModeValue(initialProfile?.groupMode, 'none');
        const ruleId = String(initialProfile?.ruleId || '').trim();
        const hasTaskModeOption = !!(SettingsStore.data.groupByTaskName || state.groupByTaskName || mode === 'task');
        const titleText = kind === 'doc'
            ? `页签规则和分组设置`
            : (kind === 'allTabs' ? `全部页签规则和分组设置` : `当前文档分组默认规则和分组设置`);
        const scopeText = kind === 'doc'
            ? `作用到页签：${docName}`
            : (kind === 'allTabs' ? `仅作用到“全部”页签：${groupName}` : `作用到分组内单文档：${groupName}`);
        const inheritSource = storedProfile
            ? (kind === 'doc' ? '页签自定义' : (kind === 'allTabs' ? '全部页签专用' : '分组默认'))
            : (kind === 'doc'
                ? (__tmGetStoredGroupViewProfile(currentGroupId) ? '分组默认' : '全局默认')
                : ((kind === 'allTabs' && __tmGetStoredGroupViewProfile(currentGroupId)) ? '分组默认' : '全局默认'));
        const inheritText = `当前规则：${inheritSource} / ${__tmDescribeViewProfile(initialProfile)}`;
        const ruleOptionsHtml = [
            '<option value="">全部</option>',
            ...(Array.isArray(state.filterRules) ? state.filterRules : [])
                .filter((rule) => !!rule?.enabled)
                .map((rule) => `<option value="${esc(String(rule.id || ''))}" ${ruleId === String(rule.id || '') ? 'selected' : ''}>${esc(String(rule.name || '未命名规则'))}</option>`)
        ].join('');

        __tmCloseViewProfileConfigModal();
        const modal = document.createElement('div');
        modal.className = 'tm-modal tm-view-profile-config-modal';
        modal.style.zIndex = '200003';
        modal.innerHTML = `
            <div class="tm-box" style="width:min(92vw,520px); height:auto; max-height:80vh; position:relative;">
                <div class="tm-header">
                    <div style="font-size:18px; font-weight:700; color:var(--tm-text-color);">${esc(titleText)}</div>
                    <button class="tm-btn tm-btn-gray" data-tm-vp-close>关闭</button>
                </div>
                <div style="padding:18px 20px; display:flex; flex-direction:column; gap:14px;">
                    <div style="font-size:14px; color:var(--tm-text-color); font-weight:600;">${esc(scopeText)}</div>
                    <div style="font-size:12px; color:var(--tm-secondary-text); line-height:1.6;">${esc(inheritText)}</div>
                    <label style="display:flex; flex-direction:column; gap:6px;">
                        <span style="font-size:13px; color:var(--tm-text-color);">规则</span>
                        <select class="tm-rule-select" data-tm-vp-field="rule">
                            ${ruleOptionsHtml}
                        </select>
                    </label>
                    <label style="display:flex; flex-direction:column; gap:6px;">
                        <span style="font-size:13px; color:var(--tm-text-color);">分组</span>
                        <select class="tm-rule-select" data-tm-vp-field="mode">
                            <option value="none" ${mode === 'none' ? 'selected' : ''}>不分组</option>
                            <option value="doc" ${mode === 'doc' ? 'selected' : ''}>按文档</option>
                            <option value="time" ${mode === 'time' ? 'selected' : ''}>按时间</option>
                            <option value="quadrant" ${mode === 'quadrant' ? 'selected' : ''}>四象限</option>
                            ${hasTaskModeOption ? `<option value="task" ${mode === 'task' ? 'selected' : ''}>按任务名</option>` : ''}
                        </select>
                    </label>
                    ${kind === 'allTabs'
                        ? `<div style="font-size:12px; color:var(--tm-secondary-text); line-height:1.6;">这套配置只在当前分组切到“全部”页签时生效，不会影响该分组里的单个文档页签。</div>`
                        : ''}
                    <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; padding-top:4px;">
                        ${storedProfile ? `<button class="tm-btn tm-btn-gray" data-tm-vp-clear>${kind === 'doc' ? '清除页签自定义' : (kind === 'allTabs' ? '清除全部页签专用配置' : '清除分组默认')}</button>` : ''}
                        <button class="tm-btn tm-btn-secondary" data-tm-vp-cancel>取消</button>
                        <button class="tm-btn tm-btn-primary" data-tm-vp-save>保存</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => __tmCloseViewProfileConfigModal();
        const saveBtn = modal.querySelector('[data-tm-vp-save]');
        const clearBtn = modal.querySelector('[data-tm-vp-clear]');
        const cancelBtn = modal.querySelector('[data-tm-vp-cancel]');
        const closeBtn = modal.querySelector('[data-tm-vp-close]');
        const ruleSelect = modal.querySelector('[data-tm-vp-field="rule"]');
        const modeSelect = modal.querySelector('[data-tm-vp-field="mode"]');

        closeBtn.onclick = close;
        cancelBtn.onclick = close;
        modal.onclick = (ev) => {
            if (ev.target === modal) close();
        };
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const nextRuleId = String(ruleSelect?.value || '').trim() || null;
                const nextMode = __tmNormalizeGroupModeValue(modeSelect?.value, 'none');
                await __tmSaveViewProfileConfig(kind, targetId, { ruleId: nextRuleId, groupMode: nextMode });
                close();
            };
        }
        if (clearBtn) {
            clearBtn.onclick = async () => {
                await window.tmClearViewProfile?.(kind, targetId);
                close();
            };
        }
    };

    function __tmHideDocTabMenu() {
        ['tm-doc-tab-menu', 'tm-doc-tab-switcher-menu'].forEach((id) => {
            const menu = document.getElementById(id);
            if (menu) menu.remove();
        });
        if (state.docTabMenuCloseHandler) {
            __tmClearOutsideCloseHandler(state.docTabMenuCloseHandler);
            state.docTabMenuCloseHandler = null;
        }
    }

    function __tmUnbindOutsideCloseHandler(handler) {
        if (typeof handler !== 'function') return;
        try { document.removeEventListener('click', handler); } catch (e) {}
        try { document.removeEventListener('contextmenu', handler); } catch (e) {}
        try { document.removeEventListener('pointerdown', handler); } catch (e) {}
        try { document.removeEventListener('touchstart', handler); } catch (e) {}
    }

    function __tmScheduleBindOutsideCloseHandler(handler, options = {}) {
        if (typeof handler !== 'function') return;
        const ignoreSelector = String(options.ignoreSelector || '').trim();
        const wrapped = (ev) => {
            const target = ev?.target instanceof Element ? ev.target : null;
            if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
            handler(ev);
        };
        try { handler.__tmOutsideCloseWrapped = wrapped; } catch (e) {}
        try {
            if (handler.__tmOutsideCloseTimer) {
                clearTimeout(handler.__tmOutsideCloseTimer);
                handler.__tmOutsideCloseTimer = null;
            }
        } catch (e) {}
        const timer = setTimeout(() => {
            try { document.addEventListener('click', wrapped); } catch (e) {}
            try { document.addEventListener('contextmenu', wrapped); } catch (e) {}
            try { document.addEventListener('pointerdown', wrapped); } catch (e) {}
            try { document.addEventListener('touchstart', wrapped, { passive: true }); } catch (e) {}
            try { handler.__tmOutsideCloseTimer = null; } catch (e) {}
        }, 0);
        try { handler.__tmOutsideCloseTimer = timer; } catch (e) {}
    }

    function __tmClearOutsideCloseHandler(handler) {
        if (typeof handler !== 'function') return;
        try {
            if (handler.__tmOutsideCloseTimer) {
                clearTimeout(handler.__tmOutsideCloseTimer);
                handler.__tmOutsideCloseTimer = null;
            }
        } catch (e) {}
        const wrapped = handler.__tmOutsideCloseWrapped || handler;
        __tmUnbindOutsideCloseHandler(wrapped);
        try { handler.__tmOutsideCloseWrapped = null; } catch (e) {}
    }

    function __tmClampFloatingMenuToViewport(menu, x, y, options = {}) {
        if (!(menu instanceof HTMLElement)) return;
        const margin = Math.max(0, Number(options.margin) || 8);
        const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
        const viewportHeight = Math.max(0, window.innerHeight || document.documentElement?.clientHeight || 0);
        const rect = menu.getBoundingClientRect();
        let nextLeft = Number(x) || 0;
        let nextTop = Number(y) || 0;
        if (nextLeft + rect.width > viewportWidth - margin) nextLeft = viewportWidth - rect.width - margin;
        if (nextTop + rect.height > viewportHeight - margin) nextTop = viewportHeight - rect.height - margin;
        nextLeft = Math.max(margin, nextLeft);
        nextTop = Math.max(margin, nextTop);
        try { menu.style.left = `${Math.round(nextLeft)}px`; } catch (e) {}
        try { menu.style.top = `${Math.round(nextTop)}px`; } catch (e) {}
    }

    function __tmGetDocPinnedIdsForGroup(groupId) {
        const gid = String(groupId || 'all').trim() || 'all';
        const map0 = SettingsStore.data?.docPinnedByGroup;
        const map = (map0 && typeof map0 === 'object' && !Array.isArray(map0)) ? map0 : {};
        const list0 = Array.isArray(map[gid]) ? map[gid] : [];
        return list0.map(id => String(id || '').trim()).filter(Boolean);
    }

    function __tmIsDocPinnedInGroup(docId, groupId) {
        const id = String(docId || '').trim();
        if (!id) return false;
        return __tmGetDocPinnedIdsForGroup(groupId).includes(id);
    }

    function __tmSortDocEntriesByPinned(docEntries, groupId) {
        const list = Array.isArray(docEntries) ? [...docEntries] : [];
        if (list.length <= 1) return list;
        const pinned = __tmGetDocPinnedIdsForGroup(groupId);
        if (!pinned.length) return list;
        const rank = new Map();
        pinned.forEach((id, idx) => rank.set(String(id || '').trim(), idx));
        return list.sort((a, b) => {
            const aId = String((a && typeof a === 'object') ? (a.id || '') : (a || '')).trim();
            const bId = String((b && typeof b === 'object') ? (b.id || '') : (b || '')).trim();
            const ai = rank.has(aId) ? rank.get(aId) : -1;
            const bi = rank.has(bId) ? rank.get(bId) : -1;
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return 0;
        });
    }

    function __tmGetDocTabSortMode() {
        const mode = String(SettingsStore.data?.docTabSortMode || 'created_desc').trim();
        return ['created_desc', 'created_asc', 'deadline_desc', 'deadline_asc', 'name_asc', 'name_desc'].includes(mode) ? mode : 'created_desc';
    }

    function __tmIsDocTabDeadlineSortMode(mode = '') {
        const value = String(mode || '').trim();
        return value === 'deadline_desc' || value === 'deadline_asc';
    }

    function __tmParseDocCreatedTs(value) {
        const raw = String(value || '').trim();
        if (!raw) return 0;
        if (/^\d+$/.test(raw)) {
            const normalized = raw.length === 14 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}` : raw;
            const ts = Date.parse(normalized);
            if (Number.isFinite(ts)) return ts;
            const asNum = Number(raw);
            if (Number.isFinite(asNum)) return asNum;
        }
        const ts = Date.parse(raw);
        return Number.isFinite(ts) ? ts : 0;
    }

    function __tmGetDocExpectedDeadlineTs(docOrId) {
        const id = String((docOrId && typeof docOrId === 'object') ? (docOrId.id || '') : (docOrId || '')).trim();
        if (!id) return Number.NaN;
        const meta = __tmGetCachedDocExpectedMeta(id);
        const ts = __tmParseDateOnlyToLocalNoonTs(meta?.deadline || '');
        return ts > 0 ? ts : Number.NaN;
    }

    function __tmScheduleDocTabSortMetaWarmup(docEntries, mode = __tmGetDocTabSortMode()) {
        if (!__tmIsDocTabDeadlineSortMode(mode)) return;
        const ids = Array.from(new Set((Array.isArray(docEntries) ? docEntries : [])
            .map((doc) => String((doc && typeof doc === 'object') ? (doc.id || '') : (doc || '')).trim())
            .filter((id) => id && !__tmIsOtherBlockTabId(id) && !__tmGetCachedDocExpectedMeta(id) && !__tmDocTabSortMetaWarmupIds.has(id))));
        if (!ids.length) return;
        ids.forEach((id) => __tmDocTabSortMetaWarmupIds.add(id));
        Promise.resolve().then(async () => {
            let shouldRerender = false;
            try {
                await Promise.all(ids.map(async (id) => {
                    const before = __tmGetCachedDocExpectedMeta(id);
                    const meta = await __tmLoadDocExpectedMeta(id);
                    if (String(before?.deadline || '').trim() !== String(meta?.deadline || '').trim()) {
                        shouldRerender = true;
                    }
                }));
            } catch (e) {
            } finally {
                ids.forEach((id) => __tmDocTabSortMetaWarmupIds.delete(id));
            }
            if (!shouldRerender) return;
            if (!__tmIsDocTabDeadlineSortMode()) return;
            if (!(globalThis.__tmRuntimeState?.hasLiveModal?.() ?? (state.modal && document.body.contains(state.modal)))) return;
            try {
                __tmScheduleRender({ withFilters: false, reason: 'doc-tab-sort-meta-warmup' });
            } catch (e) {
                try { render(); } catch (e2) {}
            }
        }).catch(() => {
            ids.forEach((id) => __tmDocTabSortMetaWarmupIds.delete(id));
        });
    }

    function __tmSortDocEntriesForTabs(docEntries, groupId) {
        const pinnedSorted = __tmSortDocEntriesByPinned(docEntries, groupId);
        if (pinnedSorted.length <= 1) return pinnedSorted;
        const mode = __tmGetDocTabSortMode();
        const pinned = __tmGetDocPinnedIdsForGroup(groupId);
        const pinnedSet = new Set(pinned);
        const pinnedPart = [];
        const normalPart = [];
        pinnedSorted.forEach((doc) => {
            const id = String((doc && typeof doc === 'object') ? (doc.id || '') : (doc || '')).trim();
            if (id && pinnedSet.has(id)) pinnedPart.push(doc);
            else normalPart.push(doc);
        });
        __tmScheduleDocTabSortMetaWarmup(normalPart, mode);
        normalPart.sort((a, b) => {
            const an = __tmGetDocDisplayName(a, String(a?.name || '').trim() || '未命名文档');
            const bn = __tmGetDocDisplayName(b, String(b?.name || '').trim() || '未命名文档');
            if (__tmIsDocTabDeadlineSortMode(mode)) {
                const ad = __tmGetDocExpectedDeadlineTs(a);
                const bd = __tmGetDocExpectedDeadlineTs(b);
                const aHasDeadline = Number.isFinite(ad) && ad > 0;
                const bHasDeadline = Number.isFinite(bd) && bd > 0;
                if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;
                if (aHasDeadline && bHasDeadline && ad !== bd) {
                    return mode === 'deadline_asc' ? ad - bd : bd - ad;
                }
                const nameDiff = an.localeCompare(bn, 'zh-Hans-CN');
                if (nameDiff) return nameDiff;
                const at = __tmParseDocCreatedTs(a?.created);
                const bt = __tmParseDocCreatedTs(b?.created);
                if (at !== bt) return bt - at;
                return String(a?.id || '').localeCompare(String(b?.id || ''), 'zh-Hans-CN');
            }
            if (mode === 'name_asc') return an.localeCompare(bn, 'zh-Hans-CN');
            if (mode === 'name_desc') return bn.localeCompare(an, 'zh-Hans-CN');
            const at = __tmParseDocCreatedTs(a?.created);
            const bt = __tmParseDocCreatedTs(b?.created);
            if (at !== bt) return mode === 'created_asc' ? at - bt : bt - at;
            return an.localeCompare(bn, 'zh-Hans-CN');
        });
        return [...pinnedPart, ...normalPart];
    }

    function __tmMoveGlobalNewTaskDocFirst(docIds) {
        const list = Array.isArray(docIds) ? [...docIds] : [];
        if (list.length <= 1) return list;
        const globalDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        if (!globalDocId || globalDocId === '__dailyNote__') return list;
        const idx = list.findIndex(id => String(id || '').trim() === globalDocId);
        if (idx <= 0) return list;
        const [target] = list.splice(idx, 1);
        list.unshift(target);
        return list;
    }

    function __tmCalcGroupDurationText(items) {
        const list = Array.isArray(items) ? items : [];
        const durationFormat = SettingsStore.data.durationFormat || 'hours';
        let totalMinutes = 0;
        list.forEach((task) => {
            const minutes = __tmParseDurationMinutes(task?.duration);
            if (!(Number.isFinite(minutes) && minutes > 0)) return;
            totalMinutes += minutes;
        });
        if (totalMinutes <= 0) return '';
        if (durationFormat === 'hours') {
            const hours = totalMinutes / 60;
            if (hours < 1) return `${Math.round(totalMinutes)}min`;
            if (hours === Math.floor(hours)) return `${Math.round(hours)}h`;
            return `${hours.toFixed(1)}h`;
        }
        return `${totalMinutes}min`;
    }

    function __tmGetVisibleDocTabsForCurrentGroup() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const docsForTabs = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId);
        const globalNewTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const activeDocId = String(state.activeDocId || '').trim();
        const filteredDocIdSet = new Set((Array.isArray(state.filteredDocIdsForTabs) ? state.filteredDocIdsForTabs : []).map((id) => String(id || '').trim()).filter(Boolean));
        return docsForTabs
            .filter((doc) => {
                const docId = String(doc?.id || '').trim();
                if (docId && activeDocId && activeDocId !== 'all' && docId === activeDocId) return true;
                return filteredDocIdSet.size ? filteredDocIdSet.has(docId) : __tmDocHasUndoneTasks(doc);
            })
            .filter(doc => !globalNewTaskDocId || String(doc?.id || '').trim() !== globalNewTaskDocId)
            .map(doc => ({
                id: String(doc?.id || '').trim(),
                name: String(doc?.name || '').trim() || '未命名文档',
                alias: __tmNormalizeDocAliasValue(doc?.alias),
                created: String(doc?.created || '').trim(),
            }))
            .filter(doc => !!doc.id);
    }

    function __tmGetCurrentGroupSourceEntries(groupId = SettingsStore.data.currentGroupId) {
        const currentGroupId = String(groupId || 'all').trim() || 'all';
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const targetDocs = [];
        if (currentGroupId === 'all') {
            const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            legacyIds.forEach((id) => {
                const did = String(id || '').trim();
                if (did) targetDocs.push({ id: did, kind: 'doc', recursive: false });
            });
            groups.forEach((group) => {
                targetDocs.push(...__tmGetGroupSourceEntries(group));
            });
            return targetDocs;
        }
        const group = groups.find((item) => String(item?.id || '').trim() === currentGroupId);
        return group ? __tmGetGroupSourceEntries(group) : [];
    }

    async function __tmResolveCurrentGroupAllDocEntries(options = {}) {
        const currentGroupId = String(options?.groupId || SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const excludeDocId = String(options?.excludeDocId || '').trim();
        const includeCurrent = options?.includeCurrent === true;
        const targetDocs = __tmGetCurrentGroupSourceEntries(currentGroupId);
        const seenDocIds = new Set();
        const docIds = [];
        const pushDocId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seenDocIds.has(id)) return;
            seenDocIds.add(id);
            docIds.push(id);
        };

        if (targetDocs.length > 0) {
            await Promise.all(targetDocs.map((entry) => __tmExpandSourceEntryDocIds(entry, pushDocId)));
        }
        if (!docIds.length) {
            __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId).forEach((doc) => pushDocId(doc?.id));
        }
        if (!docIds.length) return [];

        let allDocuments = Array.isArray(state.allDocuments) ? state.allDocuments : [];
        if (!allDocuments.length) {
            try { allDocuments = await __tmEnsureAllDocumentsLoaded(false); } catch (e) {}
        }

        const docMetaMap = new Map();
        (Array.isArray(allDocuments) ? allDocuments : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (id) docMetaMap.set(id, doc);
        });
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id || docMetaMap.has(id)) return;
            docMetaMap.set(id, doc);
        });

        const docs = docIds
            .map((id) => {
                const meta = docMetaMap.get(id) || null;
                const name = String(meta?.name || '').trim() || __tmGetDocRawName(id, '') || id || '未命名文档';
                return {
                    id,
                    name,
                    alias: __tmNormalizeDocAliasValue(meta?.alias),
                    created: String(meta?.created || '').trim(),
                    icon: __tmNormalizeDocIconValue(meta?.icon),
                    path: String(meta?.path || '').trim(),
                };
            })
            .filter((doc) => !!doc.id && (includeCurrent || doc.id !== excludeDocId));

        return __tmSortDocEntriesForTabs(docs, currentGroupId);
    }

    function __tmGetCurrentDocTabSwitcherItems() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const currentGroup = (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
            .find((group) => String(group?.id || '').trim() === currentGroupId);
        const groupName = currentGroupId === 'all' ? '全部文档' : __tmResolveDocGroupName(currentGroup);
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const items = [{
            id: 'all',
            label: '全部',
            kind: 'all',
            active: activeDocId === 'all',
        }];

        const globalNewTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        if (globalNewTaskDocId && globalNewTaskDocId !== '__dailyNote__' && !__tmIsDocExcludedInGroup(globalNewTaskDocId, currentGroupId)) {
            items.push({
                id: globalNewTaskDocId,
                label: __tmGetDocDisplayName(globalNewTaskDocId, '未命名文档'),
                kind: 'doc',
                iconHtml: __tmRenderDocIcon(globalNewTaskDocId, { fallbackText: '📥', size: 14 }),
                active: activeDocId === globalNewTaskDocId,
            });
        }

        if (currentGroupId !== 'all' && Array.isArray(state.otherBlocks) && state.otherBlocks.length > 0) {
            items.push({
                id: __TM_OTHER_BLOCK_TAB_ID,
                label: __TM_OTHER_BLOCK_TAB_NAME,
                kind: 'other',
                iconHtml: '<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;min-width:14px;line-height:1;">🧩</span>',
                active: __tmIsOtherBlockTabId(activeDocId),
            });
        }

        __tmGetVisibleDocTabsForCurrentGroup().forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id) return;
            items.push({
                id,
                label: __tmGetDocDisplayName(doc, String(doc?.name || '').trim() || '未命名文档'),
                kind: 'doc',
                iconHtml: __tmRenderDocIcon(doc, { size: 14 }),
                active: activeDocId === id,
            });
        });

        return {
            currentGroupId,
            groupName,
            items,
        };
    }

    function __tmGetAllDocTabTriggerElement(source) {
        const target = source?.currentTarget instanceof Element
            ? source.currentTarget
            : (source?.target instanceof Element ? source.target : null);
        if (target instanceof Element) {
            const directTrigger = target.closest('[data-tm-all-doc-menu-trigger="1"]');
            if (directTrigger instanceof HTMLElement) return directTrigger;
            const found = target.closest('.tm-doc-tab--all');
            if (found instanceof HTMLElement) return found;
        }
        try {
            const fallback = state.modal?.querySelector?.('.tm-doc-tab--all');
            if (fallback instanceof HTMLElement) return fallback;
        } catch (e) {}
        return null;
    }

    function __tmClearAllDocTabLongPressTimer() {
        try {
            if (state.allDocTabLongPressTimer) {
                clearTimeout(state.allDocTabLongPressTimer);
                state.allDocTabLongPressTimer = null;
            }
        } catch (e) {}
    }

    function __tmFinishAllDocTabLongPress(event, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const fired = !!state.allDocTabLongPressFired;
        __tmClearAllDocTabLongPressTimer();
        state.allDocTabLongPressMoved = false;
        state.allDocTabLongPressTrigger = null;
        state.allDocTabLongPressStartX = 0;
        state.allDocTabLongPressStartY = 0;
        if (fired && opts.suppressClick !== false) {
            state.allDocTabSuppressClickUntil = Date.now() + 700;
            try { event?.preventDefault?.(); } catch (e) {}
            try { event?.stopPropagation?.(); } catch (e) {}
        }
        state.allDocTabLongPressFired = false;
    }

    const __tmShouldUseCompactTopbarBrand = () => {
        return true;
    };

    function __tmClearTopbarManagerIconLongPressTimer() {
        try {
            if (state.topbarManagerIconLongPressTimer) {
                clearTimeout(state.topbarManagerIconLongPressTimer);
                state.topbarManagerIconLongPressTimer = null;
            }
        } catch (e) {}
    }

    function __tmFinishTopbarManagerIconLongPress(event, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const fired = !!state.topbarManagerIconLongPressFired;
        __tmClearTopbarManagerIconLongPressTimer();
        state.topbarManagerIconLongPressMoved = false;
        state.topbarManagerIconTrigger = null;
        state.topbarManagerIconLongPressStartX = 0;
        state.topbarManagerIconLongPressStartY = 0;
        try { state.__tmPluginIconLongPressing = false; } catch (e) {}
        if (fired && opts.suppressClick !== false) {
            state.topbarManagerIconSuppressClickUntil = Date.now() + 700;
            try { event?.preventDefault?.(); } catch (e) {}
            try { event?.stopPropagation?.(); } catch (e) {}
        }
        state.topbarManagerIconLongPressFired = false;
    }

    async function __tmSetDocPinnedForGroup(docId, pinned, groupId) {
        const id = String(docId || '').trim();
        const gid = String(groupId || 'all').trim() || 'all';
        if (!id) return;
        const map0 = SettingsStore.data.docPinnedByGroup;
        const map = (map0 && typeof map0 === 'object' && !Array.isArray(map0)) ? map0 : {};
        const list0 = Array.isArray(map[gid]) ? map[gid] : [];
        const next = list0.map(x => String(x || '').trim()).filter(Boolean).filter(x => x !== id);
        if (pinned) next.unshift(id);
        map[gid] = next;
        SettingsStore.data.docPinnedByGroup = map;
        await SettingsStore.save();
    }

    function __tmShowDocTabMenuAt(docId, x, y) {
        const id = String(docId || '').trim();
        if (!id || id === 'all') return;
        __tmHideDocTabMenu();

        const menu = document.createElement('div');
        menu.id = 'tm-doc-tab-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${Math.max(8, Number(y) || 0)}px;
            left: ${Math.max(8, Number(x) || 0)}px;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-theme-surface-light);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 200000;
            min-width: 160px;
            max-width: calc(100vw - 16px);
            box-sizing: border-box;
            user-select: none;
        `;

        const isOtherBlocksTab = __tmIsOtherBlockTabId(id);
        const rawName = isOtherBlocksTab
            ? __TM_OTHER_BLOCK_TAB_NAME
            : __tmGetDocRawName(id, id);
        const alias = isOtherBlocksTab ? '' : __tmGetDocAliasValue(id);
        const name = isOtherBlocksTab ? rawName : __tmGetDocDisplayName(id, rawName);

        const title = document.createElement('div');
        title.textContent = String(name || '文档');
        title.style.cssText = 'padding: 6px 10px; font-size: 12px; opacity: 0.75; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        menu.appendChild(title);

        if (!isOtherBlocksTab && alias && alias !== rawName) {
            const subtitle = document.createElement('div');
            subtitle.textContent = name === alias ? `文档名：${rawName}` : `别名：${alias}`;
            subtitle.style.cssText = 'padding: 0 10px 6px; font-size: 12px; opacity: 0.58; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            menu.appendChild(subtitle);
        }

        const hr = document.createElement('hr');
        hr.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
        menu.appendChild(hr);

        const item = (text, onClick) => {
            const el = document.createElement('div');
            const labelText = String(text || '');
            if (/<[a-z][\s\S]*>/i.test(labelText)) el.innerHTML = labelText;
            else el.textContent = labelText;
            el.style.cssText = 'padding: 6px 10px; cursor: pointer; font-size: 13px; display:flex; align-items:center; gap:8px; white-space:nowrap; width:100%; box-sizing:border-box;';
            el.onmouseenter = () => el.style.backgroundColor = 'var(--b3-theme-surface-light)';
            el.onmouseleave = () => el.style.backgroundColor = 'transparent';
            el.onclick = (e) => {
                try { e.stopPropagation(); } catch (e2) {}
                __tmHideDocTabMenu();
                try { onClick?.(); } catch (e2) {}
            };
            return el;
        };

        const submenuItem = (text, childrenBuilder) => {
            const el = document.createElement('div');
            el.style.cssText = 'position:relative;padding: 6px 10px; cursor: pointer; font-size: 13px; display:flex; align-items:center; justify-content:space-between; gap:10px; white-space:nowrap; width:100%; box-sizing:border-box;';
            const label = document.createElement('span');
            const labelText = String(text || '');
            if (/<[a-z][\s\S]*>/i.test(labelText)) label.innerHTML = labelText;
            else label.textContent = labelText;
            label.style.cssText = 'min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            const arrow = document.createElement('span');
            arrow.textContent = '›';
            arrow.style.cssText = 'opacity:0.75; flex:0 0 auto;';
            el.appendChild(label);
            el.appendChild(arrow);

            const submenu = document.createElement('div');
            submenu.style.cssText = `
                position:absolute;
                top:-4px;
                left:calc(100% - 4px);
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-theme-surface-light);
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                padding: 4px 0;
                width:auto;
                min-width: 180px;
                max-width: calc(100vw - 16px);
                box-sizing: border-box;
                display:none;
                z-index: 200001;
            `;
            const children = childrenBuilder?.() || [];
            children.forEach((child) => submenu.appendChild(child));
            el.appendChild(submenu);

            let hideTimer = null;
            const fitSubmenuWidth = () => {
                try {
                    const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
                    const maxWidth = Math.max(180, viewportWidth - 16);
                    const rows = Array.from(submenu.children || []).filter((child) => child instanceof HTMLElement);
                    rows.forEach((row) => {
                        try { row.style.width = 'auto'; } catch (e) {}
                    });
                    try { submenu.style.width = 'auto'; } catch (e) {}
                    let naturalWidth = 0;
                    rows.forEach((row) => {
                        try {
                            naturalWidth = Math.max(
                                naturalWidth,
                                Math.ceil(row.scrollWidth || row.getBoundingClientRect().width || 0)
                            );
                        } catch (e) {}
                    });
                    const nextWidth = Math.min(maxWidth, Math.max(180, naturalWidth + 2));
                    submenu.style.width = `${nextWidth}px`;
                    rows.forEach((row) => {
                        try { row.style.width = '100%'; } catch (e) {}
                    });
                } catch (e) {}
            };
            const updateSubmenuPosition = () => {
                try {
                    submenu.style.left = 'calc(100% - 4px)';
                    submenu.style.right = 'auto';
                    submenu.style.top = '-4px';
                    const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
                    const viewportHeight = Math.max(0, window.innerHeight || document.documentElement?.clientHeight || 0);
                    const margin = 8;
                    let rect = submenu.getBoundingClientRect();
                    if (rect.right > viewportWidth - margin) {
                        submenu.style.left = 'auto';
                        submenu.style.right = 'calc(100% - 4px)';
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.left < margin) {
                        submenu.style.left = '0';
                        submenu.style.right = 'auto';
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.bottom > viewportHeight - margin) {
                        const overflow = rect.bottom - (viewportHeight - margin);
                        submenu.style.top = `${Math.min(-4, -4 - Math.round(overflow))}px`;
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.top < margin) {
                        submenu.style.top = `${Math.max(margin - (el.getBoundingClientRect().top || 0), -4)}px`;
                    }
                } catch (e) {}
            };
            const showSubmenu = () => {
                if (hideTimer) {
                    try { clearTimeout(hideTimer); } catch (e) {}
                    hideTimer = null;
                }
                el.style.backgroundColor = 'var(--b3-theme-surface-light)';
                submenu.style.display = 'block';
                fitSubmenuWidth();
                updateSubmenuPosition();
            };
            const hideSubmenu = () => {
                if (hideTimer) {
                    try { clearTimeout(hideTimer); } catch (e) {}
                }
                hideTimer = setTimeout(() => {
                    submenu.style.display = 'none';
                    el.style.backgroundColor = 'transparent';
                    hideTimer = null;
                }, 120);
            };
            el.onmouseenter = showSubmenu;
            el.onmouseleave = hideSubmenu;
            submenu.onmouseenter = showSubmenu;
            submenu.onmouseleave = hideSubmenu;
            el.onclick = (e) => {
                try { e.stopPropagation(); } catch (e2) {}
                if (submenu.style.display === 'block') hideSubmenu();
                else showSubmenu();
            };
            return el;
        };

        const docTabSortItems = [
            { value: 'created_desc', label: '创建时间降序' },
            { value: 'created_asc', label: '创建时间升序' },
            { value: 'deadline_desc', label: '截止日期降序' },
            { value: 'deadline_asc', label: '截止日期升序' },
            { value: 'name_asc', label: '名称升序' },
            { value: 'name_desc', label: '名称降序' }
        ];
        const currentDocTabSort = __tmGetDocTabSortMode();

        const map = (SettingsStore.data.docColorMap && typeof SettingsStore.data.docColorMap === 'object') ? SettingsStore.data.docColorMap : (SettingsStore.data.docColorMap = {});
        const existing = __tmNormalizeHexColor(map[id], '');
        const pinGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const pinnedInGroup = __tmIsDocPinnedInGroup(id, pinGroupId);
        const excludedInGroup = __tmIsDocExcludedInGroup(id, pinGroupId);
        const excludeRestoreTargetLabel = pinGroupId === 'all' ? '全部文档设置' : '文档分组设置';
        const docCustomProfile = __tmGetStoredDocViewProfile(id);
        const groupCustomProfile = __tmGetStoredGroupViewProfile(pinGroupId);
        const defaultProfile = __tmGetViewProfilesStore().global;
        const currentProfileSource = docCustomProfile ? 'doc' : (groupCustomProfile ? 'group' : 'default');
        const expectedMeta = __tmGetCachedDocExpectedMeta(id) || __tmNormalizeDocExpectedMeta({});
        const startDateLabel = expectedMeta.startDate ? `（${expectedMeta.startDate}）` : '';
        const deadlineLabel = expectedMeta.deadline ? `（${expectedMeta.deadline}）` : '';

        if (!isOtherBlocksTab) {
            menu.appendChild(item(__tmRenderContextMenuLabel('file-text', '打开文档'), async () => {
                await window.tmOpenDocById?.(id);
            }));
            menu.appendChild(item(__tmRenderContextMenuLabel('plus', '新建任务'), () => {
                try { window.tmQuickAddOpenForDoc?.(id); } catch (e) {}
            }));
            menu.appendChild(item(__tmRenderContextMenuLabel('square-pen', '设置别名'), async () => {
                const next = await showPrompt('设置文档别名', '留空清除，直接保存到思源原生 alias 属性', alias || '');
                if (next === null) return;
                try {
                    await __tmSaveNativeDocAlias(id, next);
                    hint(next ? '✅ 文档别名已更新' : '✅ 文档别名已清空', 'success');
                    render();
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            }));
            menu.appendChild(item(__tmRenderContextMenuLabel('calendar-plus-2', `设置开始日期${startDateLabel}`), async () => {
                const next = await showDatePrompt('设置文档开始日期', expectedMeta.startDate || '');
                if (next === null) return;
                try {
                    const saved = await __tmSaveDocExpectedMetaField(id, 'startDate', next);
                    if (__tmIsDocExpectedRangeInvalid(saved)) {
                        hint('⚠ 开始日期晚于截止日期，顶部预期进度条暂不显示', 'warning');
                    } else {
                        hint(next ? '✅ 文档开始日期已更新' : '✅ 文档开始日期已清空', 'success');
                    }
                    render();
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            }));
            menu.appendChild(item(__tmRenderContextMenuLabel('calendar-check', `设置截止日期${deadlineLabel}`), async () => {
                const next = await showDatePrompt('设置文档截止日期', expectedMeta.deadline || '');
                if (next === null) return;
                try {
                    const saved = await __tmSaveDocExpectedMetaField(id, 'deadline', next);
                    if (__tmIsDocExpectedRangeInvalid(saved)) {
                        hint('⚠ 截止日期早于开始日期，顶部预期进度条暂不显示', 'warning');
                    } else {
                        hint(next ? '✅ 文档截止日期已更新' : '✅ 文档截止日期已清空', 'success');
                    }
                    render();
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            }));
        }
        menu.appendChild(item(__tmRenderContextMenuLabel('settings', '规则和分组设置'), () => {
            window.tmOpenViewProfileConfigModal?.('doc', id);
        }));
        if (!isOtherBlocksTab) {
            menu.appendChild(item(__tmRenderContextMenuLabel('pin', pinnedInGroup ? '取消钉住' : '钉住到最左侧'), async () => {
                await __tmSetDocPinnedForGroup(id, !pinnedInGroup, pinGroupId);
                await loadSelectedDocuments();
            }));
            menu.appendChild(item(__tmRenderContextMenuLabel('eye-off', '排除当前文档'), async () => {
                if (excludedInGroup) {
                    hint(`ℹ 当前文档已在排除列表中，恢复显示请到${excludeRestoreTargetLabel}中移出排除列表`, 'info');
                    return;
                }
                const result = await __tmSetDocExcludedForGroup(id, true, pinGroupId);
                if (!result?.changed) return;
                hint(`✅ 已排除当前文档。恢复显示请到${excludeRestoreTargetLabel}中移出排除列表`, 'success');
            }));
        }

        if (isOtherBlocksTab) {
            menu.appendChild(item(__tmRenderContextMenuLabel('brush-cleaning', '设置页签颜色'), () => {
                const initial = existing || __tmGetDocColorHex(id, __tmIsDarkMode());
                __tmOpenColorPickerDialog('其他块页签颜色', initial, async (next) => {
                    const v = __tmNormalizeHexColor(next, '');
                    if (!v) return;
                    map[id] = v;
                    try { await SettingsStore.save(); } catch (e) {}
                    __tmRefreshDocColorPresentation();
                }, __tmBuildPresetColorPickerOptions(initial));
            }));

            menu.appendChild(item(__tmRenderContextMenuLabel('arrow-clockwise', '恢复自动页签颜色'), async () => {
                if (map[id]) delete map[id];
                try { await SettingsStore.save(); } catch (e) {}
                __tmRefreshDocColorPresentation();
            }));
        } else {
            menu.appendChild(submenuItem(__tmRenderContextMenuLabel('brush-cleaning', '颜色与色系'), () => {
                const children = [];
                children.push(item(__tmRenderContextMenuLabel('brush-cleaning', '设置当前文档颜色'), () => {
                    const initial = existing || __tmGetDocColorHex(id, __tmIsDarkMode());
                    __tmOpenColorPickerDialog('文档颜色', initial, async (next) => {
                        const v = __tmNormalizeHexColor(next, '');
                        if (!v) return;
                        map[id] = v;
                        try { await SettingsStore.save(); } catch (e) {}
                        __tmRefreshDocColorPresentation();
                    }, __tmBuildPresetColorPickerOptions(initial));
                }));
                children.push(item(__tmRenderContextMenuLabel('arrow-clockwise', '恢复当前文档自动颜色'), async () => {
                    if (map[id]) delete map[id];
                    try { await SettingsStore.save(); } catch (e) {}
                    __tmRefreshDocColorPresentation();
                }));
                const divider = document.createElement('hr');
                divider.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
                children.push(divider);
                children.push(item(__tmRenderContextMenuLabel('settings', `所有文档默认色系（${__tmDescribeDocColorSchemeConfig(__tmGetGlobalDocColorSchemeConfig())}）`), () => {
                    __tmOpenDocColorSchemeConfigDialog('default');
                }));
                if (pinGroupId !== 'all') {
                    children.push(item(__tmRenderContextMenuLabel('settings', `当前分组色系（${__tmGetDocColorSchemeSummary(pinGroupId).replace(/^当前：/, '').trim()}）`), () => {
                        __tmOpenDocColorSchemeConfigDialog('group');
                    }));
                }
                return children;
            }));
        }

        if (!isOtherBlocksTab) {
            const sortHr = document.createElement('hr');
            sortHr.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
            menu.appendChild(sortHr);
            menu.appendChild(submenuItem(__tmRenderContextMenuLabel('chevrons-up-down', '页签排序'), () => docTabSortItems.map((opt) => {
                return item(__tmRenderContextMenuLabel(currentDocTabSort === opt.value ? 'check-circle-2' : 'circle-dot', opt.label), async () => {
                    SettingsStore.data.docTabSortMode = opt.value;
                    try { await SettingsStore.save(); } catch (e) {}
                    render();
                });
            })));
        }

        const profileInfo = document.createElement('div');
        profileInfo.style.cssText = 'padding: 6px 10px 2px; font-size: 12px; opacity: 0.75; line-height: 1.5;';
        profileInfo.innerHTML = `当前规则：<div style="margin-top:2px;">${esc(__tmGetViewProfileSourceLabel(currentProfileSource))} / ${esc(__tmDescribeViewProfile(docCustomProfile || groupCustomProfile || defaultProfile))}</div>`;
        menu.appendChild(profileInfo);

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            try { __tmClampFloatingMenuToViewport(menu, x, y); } catch (e) {}
        });

        const closeHandler = (ev) => {
            try {
                if (menu.contains(ev.target)) return;
            } catch (e) {}
            __tmHideDocTabMenu();
        };
        state.docTabMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler);
    }

    window.tmShowDocTabContextMenu = function(event, docId) {
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}
        try { if (state.__tmPluginIconLongPressing) return; } catch (e) {}
        __tmShowDocTabMenuAt(docId, event?.clientX, event?.clientY);
    };

    function __tmGetAllDocTabMenuContext() {
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const currentGroup = (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
            .find((group) => String(group?.id || '').trim() === groupId);
        const groupName = groupId === 'all' ? '全部文档' : __tmResolveDocGroupName(currentGroup);
        const allTabsProfile = __tmGetStoredAllTabsViewProfile(groupId);
        const groupProfile = __tmGetStoredGroupViewProfile(groupId);
        const defaultProfile = __tmGetViewProfilesStore().global;
        const currentProfile = allTabsProfile || groupProfile || defaultProfile;
        const currentProfileSource = allTabsProfile ? 'allTabs' : (groupProfile ? 'group' : 'default');
        return {
            groupId,
            groupName,
            currentProfile,
            currentProfileSource,
        };
    }

    function __tmBuildAllDocTabMenuActionButton(labelHtml, onClick, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-btn tm-btn-info bc-btn bc-btn--sm';
        try {
            if (opts.mainRow !== false) btn.dataset.tmAllDocMainRow = '1';
        } catch (e) {}
        btn.style.cssText = `
            display:flex;
            align-items:center;
            justify-content:${opts.justifyContent || 'flex-start'};
            gap:8px;
            width:${opts.stretch === false ? 'auto' : '100%'};
            min-width:0;
            padding:${opts.compact ? '7px 10px' : '8px 10px'};
            text-align:left;
            white-space:nowrap;
        `;
        if (/<[a-z][\s\S]*>/i.test(String(labelHtml || ''))) btn.innerHTML = String(labelHtml || '');
        else btn.textContent = String(labelHtml || '');
        btn.onclick = (ev) => {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            __tmHideDocTabMenu();
            try { onClick?.(); } catch (e) {}
        };
        return btn;
    }

    window.tmShowAllDocTabMenu = function(event) {
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}
        try { if (state.__tmPluginIconLongPressing) return; } catch (e) {}
        __tmHideDocTabMenu();

        const { groupName, items } = __tmGetCurrentDocTabSwitcherItems();
        const { groupId, currentProfile, currentProfileSource } = __tmGetAllDocTabMenuContext();
        const trigger = __tmGetAllDocTabTriggerElement(event);
        const rect = trigger instanceof HTMLElement ? trigger.getBoundingClientRect() : null;
        const pointerX = Number(event?.clientX);
        const pointerY = Number(event?.clientY);
        const hasPointer = Number.isFinite(pointerX) && Number.isFinite(pointerY) && (pointerX > 0 || pointerY > 0);
        const anchorX = hasPointer ? Math.round(pointerX) : (rect ? Math.round(rect.left) : 8);
        const anchorY = hasPointer ? Math.round(pointerY) : (rect ? Math.round(rect.bottom + 8) : 8);

        const menu = document.createElement('div');
        menu.id = 'tm-doc-tab-switcher-menu';
        menu.className = 'tm-popup-menu bc-dropdown-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${Math.max(8, anchorY)}px;
            left: ${Math.max(8, anchorX)}px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: auto;
            min-width: 0;
            max-width: calc(100vw - 16px);
            max-height: calc(100vh - 16px);
            padding: 8px;
            background: var(--tm-ui-popover, var(--b3-theme-background));
            border: var(--tm-topbar-control-border-width, 1px) solid var(--tm-ui-border, var(--b3-theme-surface-light));
            border-radius: calc(var(--tm-topbar-control-radius, 10px) + 2px);
            box-shadow: 0 10px 26px rgba(15,23,42,0.16);
            box-sizing: border-box;
            z-index: 200000;
            user-select: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'padding:2px 2px 0; font-size:12px; color:var(--tm-secondary-text); line-height:1.5;';
        header.textContent = `${groupName} / 全部页签`;
        menu.appendChild(header);

        const createSettingsInfoRow = () => {
            const info = document.createElement('div');
            info.style.cssText = 'padding: 4px 10px 2px; font-size: 12px; color:var(--tm-secondary-text); line-height: 1.5; min-width:0; white-space:normal; overflow-wrap:anywhere;';
            info.innerHTML = `当前规则：<div style="margin-top:2px;">${esc(__tmGetViewProfileSourceLabel(currentProfileSource))} / ${esc(__tmDescribeViewProfile(currentProfile))}</div>`;
            return info;
        };

        const createSubmenuTrigger = (labelHtml, childrenBuilder) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:relative;';

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'tm-btn tm-btn-info bc-btn bc-btn--sm';
            try { trigger.dataset.tmAllDocMainRow = '1'; } catch (e) {}
            trigger.style.cssText = `
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px;
                width:auto;
                min-width:0;
                padding:8px 10px;
                text-align:left;
            `;

            const label = document.createElement('span');
            label.style.cssText = 'display:inline-flex; align-items:center; gap:8px; min-width:0; flex:1; white-space:nowrap;';
            if (/<[a-z][\s\S]*>/i.test(String(labelHtml || ''))) label.innerHTML = String(labelHtml || '');
            else label.textContent = String(labelHtml || '');
            trigger.appendChild(label);

            const arrow = document.createElement('span');
            arrow.textContent = '›';
            arrow.style.cssText = 'flex:0 0 auto; opacity:0.75;';
            trigger.appendChild(arrow);

            const submenu = document.createElement('div');
            submenu.style.cssText = `
                position:absolute;
                top:-6px;
                left:calc(100% - 4px);
                width:auto;
                min-width:156px;
                max-width:calc(100vw - 16px);
                padding:6px;
                background: var(--tm-ui-popover, var(--b3-theme-background));
                border: var(--tm-topbar-control-border-width, 1px) solid var(--tm-ui-border, var(--b3-theme-surface-light));
                border-radius: calc(var(--tm-topbar-control-radius, 10px) + 2px);
                box-shadow: 0 10px 26px rgba(15,23,42,0.16);
                box-sizing:border-box;
                display:none;
                z-index:200001;
            `;
            const children = childrenBuilder?.() || [];
            children.forEach((child) => submenu.appendChild(child));
            wrap.appendChild(trigger);
            wrap.appendChild(submenu);

            let hideTimer = null;
            const fitSubmenuWidth = () => {
                try {
                    const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
                    const maxWidth = Math.max(156, viewportWidth - 16);
                    const rows = Array.from(submenu.querySelectorAll('button'));
                    rows.forEach((row) => {
                        try { row.style.width = 'auto'; } catch (e) {}
                    });
                    try { submenu.style.width = 'auto'; } catch (e) {}
                    let naturalWidth = 0;
                    rows.forEach((row) => {
                        try {
                            naturalWidth = Math.max(
                                naturalWidth,
                                Math.ceil(row.scrollWidth || row.getBoundingClientRect().width || 0)
                            );
                        } catch (e) {}
                    });
                    const nextWidth = Math.min(maxWidth, Math.max(156, naturalWidth + 2));
                    submenu.style.width = `${nextWidth}px`;
                    rows.forEach((row) => {
                        try { row.style.width = '100%'; } catch (e) {}
                    });
                } catch (e) {}
            };
            const updateSubmenuPosition = () => {
                try {
                    submenu.style.left = 'calc(100% - 4px)';
                    submenu.style.right = 'auto';
                    submenu.style.top = '-6px';
                    const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
                    const viewportHeight = Math.max(0, window.innerHeight || document.documentElement?.clientHeight || 0);
                    const margin = 8;
                    let rect = submenu.getBoundingClientRect();
                    if (rect.right > viewportWidth - margin) {
                        submenu.style.left = 'auto';
                        submenu.style.right = 'calc(100% - 4px)';
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.left < margin) {
                        submenu.style.left = '0';
                        submenu.style.right = 'auto';
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.bottom > viewportHeight - margin) {
                        const overflow = rect.bottom - (viewportHeight - margin);
                        submenu.style.top = `${Math.min(-6, -6 - Math.round(overflow))}px`;
                        rect = submenu.getBoundingClientRect();
                    }
                    if (rect.top < margin) {
                        submenu.style.top = `${Math.max(margin - (wrap.getBoundingClientRect().top || 0), -6)}px`;
                    }
                } catch (e) {}
            };
            const showSubmenu = () => {
                if (hideTimer) {
                    try { clearTimeout(hideTimer); } catch (e) {}
                    hideTimer = null;
                }
                try { trigger.style.backgroundColor = 'var(--b3-theme-surface-light)'; } catch (e) {}
                submenu.style.display = 'flex';
                submenu.style.flexDirection = 'column';
                submenu.style.gap = '4px';
                fitSubmenuWidth();
                updateSubmenuPosition();
            };
            const hideSubmenu = () => {
                if (hideTimer) {
                    try { clearTimeout(hideTimer); } catch (e) {}
                }
                hideTimer = setTimeout(() => {
                    submenu.style.display = 'none';
                    try { trigger.style.backgroundColor = 'transparent'; } catch (e) {}
                    hideTimer = null;
                }, 120);
            };

            trigger.onmouseenter = showSubmenu;
            wrap.onmouseleave = hideSubmenu;
            submenu.onmouseenter = showSubmenu;
            submenu.onmouseleave = hideSubmenu;
            trigger.onclick = (ev) => {
                try { ev?.preventDefault?.(); } catch (e) {}
                try { ev?.stopPropagation?.(); } catch (e) {}
                if (submenu.style.display === 'flex') hideSubmenu();
                else showSubmenu();
            };
            return wrap;
        };

        menu.appendChild(createSubmenuTrigger(__tmRenderContextMenuLabel('settings', '设置'), () => {
            const children = [];
            children.push(__tmBuildAllDocTabMenuActionButton(__tmRenderContextMenuLabel('settings', '规则和分组设置'), () => {
                window.tmOpenViewProfileConfigModal?.('allTabs', groupId);
            }, { compact: true, stretch: false, mainRow: false }));
            children.push(__tmBuildAllDocTabMenuActionButton(__tmRenderContextMenuLabel('settings', '当前文档分组默认设置'), () => {
                window.tmOpenViewProfileConfigModal?.('group', groupId);
            }, { compact: true, stretch: false, mainRow: false }));
            const divider = document.createElement('hr');
            divider.style.cssText = 'margin: 2px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
            children.push(divider);
            children.push(createSettingsInfoRow());
            return children;
        }));

        menu.appendChild(createSubmenuTrigger(__tmRenderContextMenuLabel('brush-cleaning', '颜色与色系'), () => {
            const children = [];
            children.push(__tmBuildAllDocTabMenuActionButton(
                __tmRenderContextMenuLabel('settings', `所有文档默认色系（${__tmDescribeDocColorSchemeConfig(__tmGetGlobalDocColorSchemeConfig())}）`),
                () => { __tmOpenDocColorSchemeConfigDialog('default'); },
                { compact: true, stretch: false, mainRow: false }
            ));
            if (groupId !== 'all') {
                children.push(__tmBuildAllDocTabMenuActionButton(
                    __tmRenderContextMenuLabel('settings', `当前分组色系（${__tmGetDocColorSchemeSummary(groupId).replace(/^当前：/, '').trim()}）`),
                    () => { __tmOpenDocColorSchemeConfigDialog('group'); },
                    { compact: true, stretch: false, mainRow: false }
                ));
            }
            return children;
        }));

        const topDivider = document.createElement('hr');
        topDivider.style.cssText = 'margin: 2px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
        menu.appendChild(topDivider);

        const list = document.createElement('div');
        list.style.cssText = 'display:flex; flex-direction:column; gap:4px; min-width:0; max-height:min(360px, calc(100vh - 88px)); overflow:auto; padding:2px 0 0;';

        (Array.isArray(items) ? items : []).forEach((item) => {
            const id = String(item?.id || '').trim();
            if (!id) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tm-btn tm-btn-info bc-btn bc-btn--sm';
            try { btn.dataset.tmAllDocMainRow = '1'; } catch (e) {}
            btn.style.cssText = `
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px;
                width:auto;
                min-width:0;
                padding:8px 10px;
                text-align:left;
                ${item?.active ? 'border-color: var(--tm-primary-color); background: var(--tm-selected-bg, rgba(64, 158, 255, 0.12));' : ''}
            `;

            const label = document.createElement('span');
            label.style.cssText = 'display:inline-flex; align-items:center; gap:8px; min-width:0; flex:1; overflow:hidden;';
            const iconHtml = String(item?.iconHtml || '').trim();
            label.innerHTML = `${iconHtml ? iconHtml : ''}<span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(String(item?.label || '').trim() || '未命名页签')}</span>`;
            btn.appendChild(label);

            if (item?.active) {
                const badge = document.createElement('span');
                badge.style.cssText = 'flex:0 0 auto; font-size:12px; color:var(--tm-secondary-text);';
                badge.textContent = '当前';
                btn.appendChild(badge);
            }

            btn.onclick = async (ev) => {
                try { ev?.preventDefault?.(); } catch (e) {}
                try { ev?.stopPropagation?.(); } catch (e) {}
                __tmHideDocTabMenu();
                try { await window.tmSwitchDoc?.(id); } catch (e) {}
            };
            list.appendChild(btn);
        });

        menu.appendChild(list);

        document.body.appendChild(menu);

        try {
            const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
            const maxWidth = Math.max(160, viewportWidth - 16);
            const rows = Array.from(menu.querySelectorAll('[data-tm-all-doc-main-row="1"]'));
            let naturalWidth = Math.max(
                Math.ceil(menu.scrollWidth || 0),
                Math.ceil(header.scrollWidth || 0) + 8
            );
            rows.forEach((row) => {
                try {
                    row.style.width = 'auto';
                    naturalWidth = Math.max(naturalWidth, Math.ceil(row.scrollWidth || 0));
                } catch (e) {}
            });
            const nextWidth = Math.min(maxWidth, Math.max(156, naturalWidth + 2));
            menu.style.width = `${nextWidth}px`;
            rows.forEach((row) => {
                try { row.style.width = '100%'; } catch (e) {}
            });
        } catch (e) {}

        try { __tmClampFloatingMenuToViewport(menu, anchorX, anchorY); } catch (e) {}
        try { __tmAnimatePopupIn(menu, { origin: 'top-left' }); } catch (e) {}

        const closeHandler = (ev) => {
            try {
                if (menu.contains(ev.target)) return;
            } catch (e) {}
            try {
                if (trigger instanceof Element && trigger.contains(ev.target)) return;
            } catch (e) {}
            __tmHideDocTabMenu();
        };
        state.docTabMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler);
    };

    window.tmShowAllDocTabContextMenu = function(event) {
        if (Number(state.allDocTabIgnoreContextMenuUntil || 0) > Date.now()) {
            try { event?.preventDefault?.(); } catch (e) {}
            try { event?.stopPropagation?.(); } catch (e) {}
            return;
        }
        return window.tmShowAllDocTabMenu?.(event);
    };

    window.tmShowAllDocTabLongPressMenu = function(event) {
        return window.tmShowAllDocTabMenu?.(event);
    };

    window.tmAllDocTabPressStart = function(event) {
        const type = String(event?.type || '').trim();
        const isTouch = type.startsWith('touch');
        if (!isTouch) return;
        try { if (state.__tmPluginIconLongPressing) return; } catch (e) {}
        __tmClearAllDocTabLongPressTimer();
        state.allDocTabLongPressFired = false;
        state.allDocTabLongPressMoved = false;
        state.allDocTabSuppressClickUntil = 0;
        const point = event?.touches?.[0];
        state.allDocTabLongPressStartX = Number(point?.clientX) || 0;
        state.allDocTabLongPressStartY = Number(point?.clientY) || 0;
        state.allDocTabLongPressTrigger = __tmGetAllDocTabTriggerElement(event);
        state.allDocTabLongPressTimer = setTimeout(() => {
            if (state.allDocTabLongPressMoved) return;
            state.allDocTabLongPressFired = true;
            state.allDocTabSuppressClickUntil = Date.now() + 700;
            state.allDocTabIgnoreContextMenuUntil = Date.now() + 1200;
            const trigger = state.allDocTabLongPressTrigger;
            const clientX = Number(state.allDocTabLongPressStartX) || 0;
            const clientY = Number(state.allDocTabLongPressStartY) || 0;
            __tmClearAllDocTabLongPressTimer();
            window.tmShowAllDocTabMenu?.({
                currentTarget: trigger,
                target: trigger,
                clientX,
                clientY,
                preventDefault() {},
                stopPropagation() {},
            });
        }, 460);
    };

    window.tmAllDocTabPressMove = function(event) {
        if (!state.allDocTabLongPressTimer) return;
        const t = event?.touches?.[0];
        const x = Number(t?.clientX) || 0;
        const y = Number(t?.clientY) || 0;
        const dx = x - (Number(state.allDocTabLongPressStartX) || 0);
        const dy = y - (Number(state.allDocTabLongPressStartY) || 0);
        if (Math.abs(dx) + Math.abs(dy) > 10) {
            state.allDocTabLongPressMoved = true;
            __tmClearAllDocTabLongPressTimer();
        }
    };

    window.tmAllDocTabPressEnd = function(event) {
        __tmFinishAllDocTabLongPress(event);
    };

    window.tmHandleAllDocTabClick = function(event) {
        if (Number(state.allDocTabSuppressClickUntil || 0) > Date.now()) {
            state.allDocTabSuppressClickUntil = 0;
            try { event?.preventDefault?.(); } catch (e) {}
            try { event?.stopPropagation?.(); } catch (e) {}
            return;
        }
        window.tmSwitchDoc?.('all');
    };

    window.tmDocTabTouchStart = function(event, docId) {
        if (!__tmIsMobileDevice()) return;
        // 如果正在打开插件页面，则不触发文档页签长按菜单
        try { if (state.__tmPluginIconLongPressing) return; } catch (e) {}
        try { state.docTabTouchMoved = false; } catch (e) {}
        try { if (state.docTabLongPressTimer) clearTimeout(state.docTabLongPressTimer); } catch (e) {}
        const t = event?.touches?.[0];
        const x = t?.clientX;
        const y = t?.clientY;
        try { state.docTabTouchStartX = Number(x) || 0; } catch (e) {}
        try { state.docTabTouchStartY = Number(y) || 0; } catch (e) {}
        state.docTabLongPressTimer = setTimeout(() => {
            if (state.docTabTouchMoved) return;
            if (String(docId || '').trim() === 'all') {
                window.tmShowAllDocTabLongPressMenu?.({
                    clientX: x,
                    clientY: y,
                    preventDefault() {},
                    stopPropagation() {}
                });
                return;
            }
            __tmShowDocTabMenuAt(docId, x, y);
        }, 520);
    };

    window.tmDocTabTouchMove = function(event) {
        if (!__tmIsMobileDevice()) return;
        const t = event?.touches?.[0];
        const x = Number(t?.clientX) || 0;
        const y = Number(t?.clientY) || 0;
        const dx = x - (Number(state.docTabTouchStartX) || 0);
        const dy = y - (Number(state.docTabTouchStartY) || 0);
        if (Math.abs(dx) + Math.abs(dy) > 10) state.docTabTouchMoved = true;
    };

    window.tmDocTabTouchEnd = function() {
        if (!__tmIsMobileDevice()) return;
        try { if (state.docTabLongPressTimer) clearTimeout(state.docTabLongPressTimer); } catch (e) {}
        state.docTabLongPressTimer = null;
        state.docTabTouchMoved = false;
    };

    function __tmEnsureDocTabTouchDelegation() {
        try { if (state.docTabTouchDelegationBound) return; } catch (e) {}
        state.docTabTouchDelegationBound = true;
        const start = (ev) => {
            const el = ev?.target?.closest?.('.tm-doc-tab[data-tm-doc-id]');
            if (!el) return;
            const docId = String(el.getAttribute('data-tm-doc-id') || '').trim();
            if (!docId) return;
            state.docTabTouchActive = true;
            state.docTabTouchActiveDocId = docId;
            tmDocTabTouchStart(ev, docId);
        };
        const move = (ev) => {
            if (!state.docTabTouchActive) return;
            tmDocTabTouchMove(ev);
        };
        const end = () => {
            if (!state.docTabTouchActive) return;
            state.docTabTouchActive = false;
            state.docTabTouchActiveDocId = null;
            tmDocTabTouchEnd();
        };
        const opts = { passive: true };
        state.docTabTouchDelegationHandlers = { start, move, end };
        state.docTabTouchDelegationOptions = opts;
        document.addEventListener('touchstart', start, opts);
        document.addEventListener('touchmove', move, opts);
        document.addEventListener('touchend', end, opts);
        document.addEventListener('touchcancel', end, opts);
    }

    function __tmEnsureAllDocTabTouchDelegation() {
        try { if (state.allDocTabTouchDelegationBound) return; } catch (e) {}
        state.allDocTabTouchDelegationBound = true;
        const start = (ev) => {
            const el = ev?.target?.closest?.('.tm-doc-tab--all');
            if (!el) return;
            window.tmAllDocTabPressStart?.(ev);
        };
        const move = (ev) => {
            if (!state.allDocTabLongPressTimer) return;
            window.tmAllDocTabPressMove?.(ev);
        };
        const end = (ev) => {
            if (!state.allDocTabLongPressTimer && !state.allDocTabLongPressFired) return;
            window.tmAllDocTabPressEnd?.(ev);
        };
        state.allDocTabTouchDelegationHandlers = { start, move, end };
        document.addEventListener('touchstart', start, { passive: true });
        document.addEventListener('touchmove', move, { passive: true });
        document.addEventListener('touchend', end, { passive: false });
        document.addEventListener('touchcancel', end, { passive: false });
    }

    function __tmEnsureTopbarManagerIconTouchDelegation() {
        try { if (state.topbarManagerIconTouchDelegationBound) return; } catch (e) {}
        state.topbarManagerIconTouchDelegationBound = true;
        const start = (ev) => {
            const el = ev?.target?.closest?.('[data-tm-all-doc-menu-trigger="1"]');
            if (!el) return;
            window.tmTopbarManagerIconPressStart?.(ev);
        };
        const move = (ev) => {
            if (!state.topbarManagerIconLongPressTimer) return;
            window.tmTopbarManagerIconPressMove?.(ev);
        };
        const end = (ev) => {
            if (!state.topbarManagerIconLongPressTimer && !state.topbarManagerIconLongPressFired) return;
            window.tmTopbarManagerIconPressEnd?.(ev);
        };
        state.topbarManagerIconTouchDelegationHandlers = { start, move, end };
        document.addEventListener('touchstart', start, { passive: true });
        document.addEventListener('touchmove', move, { passive: true });
        document.addEventListener('touchend', end, { passive: false });
        document.addEventListener('touchcancel', end, { passive: false });
    }

    function __tmBindWhiteboardViewportInput(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const viewport = modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        if (String(viewport.dataset?.tmWhiteboardInputBound || '') === '1') return;
        viewport.dataset.tmWhiteboardInputBound = '1';
        if (__tmIsMobileDevice()) {
            viewport.addEventListener('touchstart', window.tmWhiteboardViewportTouchStart, { passive: true });
            viewport.addEventListener('touchmove', window.tmWhiteboardViewportTouchMove, { passive: true });
            viewport.addEventListener('touchend', window.tmWhiteboardViewportTouchEnd, { passive: true });
            viewport.addEventListener('touchcancel', window.tmWhiteboardViewportTouchEnd, { passive: true });
        }
        viewport.addEventListener('wheel', window.tmWhiteboardViewportWheel, { passive: true });
        try {
            if (typeof __tmScheduleWhiteboardNavigatorUpdate === 'function') {
                __tmScheduleWhiteboardNavigatorUpdate();
            }
        } catch (e) {}
        try {
            if (typeof ResizeObserver === 'function' && !viewport.__tmWhiteboardNavigatorResizeObserver) {
                const ro = new ResizeObserver(() => {
                    try { __tmScheduleWhiteboardNavigatorUpdate(); } catch (e) {}
                });
                ro.observe(viewport);
                viewport.__tmWhiteboardNavigatorResizeObserver = ro;
            }
        } catch (e) {}
    }

    // 搜索弹窗
    window.tmShowSearchModal = function() {
        const modal = document.createElement('div');
        modal.className = 'tm-modal';
        modal.style.zIndex = '200001';
        modal.innerHTML = `
            <div class="tm-box" style="width: 500px; height: auto; max-height: 80vh; position: relative;">
                <div class="tm-header">
                    <div style="font-size: 18px; font-weight: bold; color: var(--tm-text-color);">🔍 搜索任务</div>
                    <button class="tm-btn tm-btn-gray" onclick="window.__tmCloseSearchModal?.()">关闭</button>
                </div>
                <div style="padding: 20px;">
                    <input type="text" id="tmPopupSearchInput" class="tm-input"
                           placeholder="输入关键词搜索..."
                           value="${esc(String(state.searchKeyword || ''))}"
                           style="width: 100%; margin-bottom: 15px; font-size: 16px; padding: 8px;">
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                         <button class="tm-btn tm-btn-secondary" onclick="tmSearch(''); window.__tmCloseSearchModal?.()">清除搜索</button>
                         <button class="tm-btn tm-btn-primary" onclick="tmSearch(document.getElementById('tmPopupSearchInput').value); window.__tmCloseSearchModal?.()">搜索</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.__searchUnstack = __tmModalStackBind(() => window.__tmCloseSearchModal?.());
        window.__tmCloseSearchModal = function() {
            state.__searchUnstack?.();
            state.__searchUnstack = null;
            try { modal.remove(); } catch (e) {}
        };
        setTimeout(() => modal.querySelector('input').focus(), 50);
        const input = modal.querySelector('input');
        input.onkeyup = (e) => {
            if (e.key === 'Enter') {
                tmSearch(input.value);
                window.__tmCloseSearchModal?.();
            }
        };
    };

    window.tmSearch = function(keyword) {
        const next = String(keyword || '').trim();
        state.searchKeyword = next;
        __tmScheduleRender({ withFilters: true });
    };

    window.tmSwitchDocGroup = async function(groupId) {
        const nextGroupId = String(groupId || 'all').trim() || 'all';
        const prevGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (nextGroupId === prevGroupId) {
            try { __tmHideMobileMenu(); } catch (e) {}
            return;
        }
        SettingsStore.data.currentGroupId = nextGroupId;
        __tmMarkContextInteractionQuiet('switch-doc-group', 1600);
        // 切换文档分组后，统一回到“全部文档”页签，避免白板停留在旧分组文档导致空白
        state.activeDocId = 'all';
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        state.whiteboardMultiSelectedTaskIds = [];
        state.whiteboardMultiSelectedNoteIds = [];
        await __tmApplyCurrentContextViewProfile();

        try {
            await SettingsStore.save();
            try { __tmHideMobileMenu(); } catch (e) {}
            await loadSelectedDocuments({
                showInlineLoading: true,
                loadingStyleKind: 'topbar',
                loadingDelayMs: 0,
                source: 'switch-doc-group',
            });
            if (state.viewMode === 'whiteboard') {
                try {
                    requestAnimationFrame(() => {
                        try { window.tmWhiteboardResetView?.(); } catch (e) {}
                    });
                } catch (e) {}
            }
        } catch (e) {
            try { hint(`❌ 切换失败: ${e?.message || String(e)}`, 'error'); } catch (e2) {}
            throw e;
        }
    };

    window.tmDocTabDragOver = function(ev) {
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
            ev.dataTransfer.dropEffect = 'move';
        } catch (e) {}
        // 查找最近的文档页签元素
        const tabEl = ev.target instanceof Element ? ev.target.closest('.tm-doc-tab') : null;
        if (tabEl) {
            try { tabEl.classList?.add('is-drop-target'); } catch (e) {}
        }
    };

    window.tmDocTabDragEnter = function(ev) {
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
            ev.dataTransfer.dropEffect = 'move';
        } catch (e) {}
        // 查找最近的文档页签元素
        const tabEl = ev.target instanceof Element ? ev.target.closest('.tm-doc-tab') : null;
        if (tabEl) {
            try { tabEl.classList?.add('is-drop-target'); } catch (e) {}
        }
    };

    window.tmDocTabDragLeave = function(ev) {
        try {
            const cur = ev?.currentTarget;
            const rel = ev?.relatedTarget;
            if (cur instanceof Element && rel instanceof Element && cur.contains(rel)) return;
        } catch (e) {}
        // 查找最近的文档页签元素并移除样式
        const tabEl = ev.target instanceof Element ? ev.target.closest('.tm-doc-tab') : null;
        if (tabEl) {
            try { tabEl.classList?.remove('is-drop-target'); } catch (e) {}
        }
        try { ev.currentTarget?.classList?.remove('is-drop-target'); } catch (e) {}
    };

    function __tmGetDraggedTaskId(ev) {
        let taskId = '';
        // 尝试从 dataTransfer 获取任务ID
        try {
            taskId = String(ev?.dataTransfer?.getData?.('application/x-tm-task-id') || '').trim();
            if (taskId) return taskId;
        } catch (e) {}
        // 尝试从 text/plain 获取
        try {
            const raw = String(ev?.dataTransfer?.getData?.('text/plain') || '').trim();
            if (raw && !raw.startsWith('{') && !raw.startsWith('[')) {
                taskId = raw;
            }
        } catch (e) {}
        // 最后尝试从全局状态获取
        if (!taskId) taskId = String(state.draggingTaskId || '').trim();
        // 如果任务不在flatTasks中，仍然返回taskId，让后续处理来验证任务有效性
        if (!taskId) return '';
        return taskId;
    }

    function __tmClearDocTabDropTarget() {
        try {
            state.modal?.querySelectorAll?.('.tm-doc-tab.is-drop-target')?.forEach?.((el) => {
                try { el.classList.remove('is-drop-target'); } catch (e) {}
            });
        } catch (e) {}
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
            await API.moveBlock(id, { parentID: topListId });
        } else {
            await API.moveBlock(id, { parentID: did });
        }
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                t.root_id = did;
                t.docId = did;
                const name = state.allDocuments.find(d => d.id === did)?.name || '';
                if (name) {
                    t.doc_name = name;
                    t.docName = name;
                }

                // 递归更新所有子任务的文档属性
                const updateChildTasks = (parentTask) => {
                    const children = Array.isArray(parentTask?.children) ? parentTask.children : [];
                    children.forEach(child => {
                        if (child && child.id) {
                            const childTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(child.id) || state.flatTasks?.[child.id];
                            if (childTask) {
                                childTask.root_id = did;
                                childTask.docId = did;
                                childTask.doc_name = name || childTask.doc_name;
                                childTask.docName = name || childTask.docName;
                                // 继续递归更新子任务的子任务
                                updateChildTasks(child);
                            }
                        }
                    });
                };
                updateChildTasks(t);
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

        // 像新建任务到顶部一样，将任务移动到文档最顶部
        try {
            // 获取文档的第一个子块ID
            let firstChildId = '';
            try { firstChildId = String(await API.getFirstDirectChildIdOfDoc(did) || '').trim(); } catch (e) { firstChildId = ''; }

            if (firstChildId) {
                // 如果文档有内容，移动到第一个子块之前（成为新的第一个）
                await API.moveBlock(id, { previousID: '', nextID: firstChildId, parentID: did });
            } else {
                // 如果文档为空，直接设置为文档的第一个子块
                await API.moveBlock(id, { parentID: did });
            }
        } catch (e) {
            console.error('移动任务到文档顶部失败:', e);
            // 尝试备用方案：直接设置父
            try {
                await API.moveBlock(id, { parentID: did });
            } catch (e2) {
                console.error('备用方案也失败:', e2);
                return false;
            }
        }

        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                t.root_id = did;
                t.docId = did;
                const name = state.allDocuments.find(d => d.id === did)?.name || '';
                if (name) {
                    t.doc_name = name;
                    t.docName = name;
                }
                if (o.clearHeading === true || (fromDocId && fromDocId !== did)) {
                    t.h2 = '';
                    t.h2Id = '';
                    t.h2Path = '';
                    t.h2Sort = Number.NaN;
                    t.h2Created = '';
                    t.h2Rank = Number.NaN;

                    // 递归更新所有子任务的属性（清除 h2 信息，同时更新文档ID）
                    const updateChildTasks = (parentTask) => {
                        const children = Array.isArray(parentTask?.children) ? parentTask.children : [];
                        children.forEach(child => {
                            if (child && child.id) {
                                const childTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(child.id) || state.flatTasks?.[child.id];
                                if (childTask) {
                                    childTask.h2Id = '';
                                    childTask.h2 = '';
                                    childTask.h2Rank = Number.NaN;
                                    // 同步更新子任务的文档ID
                                    childTask.root_id = did;
                                    childTask.docId = did;
                                    const name = state.allDocuments.find(d => d.id === did)?.name || '';
                                    if (name) {
                                        childTask.doc_name = name;
                                        childTask.docName = name;
                                    }
                                    // 递归更新子任务的子任务
                                    updateChildTasks(childTask);
                                }
                            }
                        });
                    };
                    updateChildTasks(t);
                }
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

        // 使用 previousID 方式将任务移动到标题块的后面
        try {
            // 直接使用 previousID 将任务移动到标题后面
            await API.moveBlock(id, { previousID: hid, parentID: did });
        } catch (e) {
            console.error('移动任务到标题后面失败:', e);
            return false;
        }

        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                t.root_id = did;
                t.docId = did;
                const name = state.allDocuments.find(d => d.id === did)?.name || '';
                if (name) {
                    t.doc_name = name;
                    t.docName = name;
                }
                const headings = state.kanbanDocHeadingsByDocId?.[did];
                const h = Array.isArray(headings) ? headings.find((x) => String(x?.id || '').trim() === hid) : null;
                t.h2 = __tmNormalizeHeadingText(h?.content);
                t.h2Id = hid;
                t.h2Rank = Number(h?.rank);
                t.h2Path = '';
                t.h2Sort = Number.NaN;
                t.h2Created = '';
                if (fromDocId && fromDocId !== did) {
                    t.parentTaskId = '';
                }

                // 递归更新所有子任务的属性
                const updateChildTasks = (parentTask, h2Id, h2Content, h2RankVal) => {
                    const children = Array.isArray(parentTask?.children) ? parentTask.children : [];
                    children.forEach(child => {
                        if (child && child.id) {
                            const childTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(child.id) || state.flatTasks?.[child.id];
                            if (childTask) {
                                childTask.h2Id = h2Id;
                                childTask.h2 = h2Content;
                                childTask.h2Rank = h2RankVal;
                                // 递归更新子任务的子任务
                                updateChildTasks(childTask, h2Id, h2Content, h2RankVal);
                            }
                        }
                    });
                };
                updateChildTasks(t, hid, __tmNormalizeHeadingText(h?.content), Number(h?.rank));
                if (state.pendingInsertedTasks?.[id]) {
                    state.pendingInsertedTasks[id].root_id = did;
                    state.pendingInsertedTasks[id].docId = did;
                    state.pendingInsertedTasks[id].h2 = __tmNormalizeHeadingText(h?.content);
                    state.pendingInsertedTasks[id].h2Id = hid;
                    state.pendingInsertedTasks[id].h2Rank = Number(h?.rank);
                }
            }
        } catch (e) {}
        if (!o.silentHint) {
            try { hint('✅ 任务已移动到标题后面', 'success'); } catch (e) {}
        }
        return true;
    }

    function __tmTaskSupportsRowDrop(task) {
        return !!task && !__tmIsCollectedOtherBlockTask(task);
    }

    function __tmIsTaskInSubtree(task, maybeDescendantId) {
        const targetId = String(maybeDescendantId || '').trim();
        if (!task || !targetId) return false;
        const stack = Array.isArray(task.children) ? [...task.children] : [];
        while (stack.length) {
            const next = stack.shift();
            if (!next) continue;
            const nextId = String(next.id || '').trim();
            if (nextId === targetId) return true;
            if (Array.isArray(next.children) && next.children.length) stack.push(...next.children);
        }
        return false;
    }

    async function __tmResolveTaskIdsForPlacement(listId, fallbackTaskIds = []) {
        const lid = String(listId || '').trim();
        const fallbackIds = Array.from(new Set(
            (Array.isArray(fallbackTaskIds) ? fallbackTaskIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        ));
        if (!lid) {
            return {
                taskIds: fallbackIds,
                domTaskIds: [],
                sqlTaskIds: [],
                source: fallbackIds.length ? 'fallback' : '',
            };
        }
        let domTaskIds = [];
        let sqlTaskIds = [];
        try { domTaskIds = await API.getTaskIdsInListByDom(lid); } catch (e) { domTaskIds = []; }
        try { sqlTaskIds = await API.getTaskIdsInList(lid); } catch (e) { sqlTaskIds = []; }
        const resolvedTaskIds = Array.isArray(domTaskIds) && domTaskIds.length > 0
            ? domTaskIds
            : (Array.isArray(sqlTaskIds) && sqlTaskIds.length > 0 ? sqlTaskIds : fallbackIds);
        const source = Array.isArray(domTaskIds) && domTaskIds.length > 0
            ? 'dom'
            : (Array.isArray(sqlTaskIds) && sqlTaskIds.length > 0 ? 'sql' : (fallbackIds.length ? 'fallback' : ''));
        return {
            taskIds: resolvedTaskIds,
            domTaskIds: Array.isArray(domTaskIds) ? domTaskIds : [],
            sqlTaskIds: Array.isArray(sqlTaskIds) ? sqlTaskIds : [],
            source,
        };
    }

    async function __tmResolveTaskMovePlacementMeta(targetTaskId) {
        const targetId = String(targetTaskId || '').trim();
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!targetId || !targetTask) throw new Error('未找到目标任务');
        const targetDocId = String(targetTask.docId || targetTask.root_id || '').trim();
        const targetListId = await __tmResolveTaskListBlockId(targetId);
        let prevSiblingTaskId = '';
        let targetListOrderSource = '';
        let targetListDomTaskIds = [];
        let targetListSqlTaskIds = [];
        if (targetListId) {
            try {
                const resolved = await __tmResolveTaskIdsForPlacement(targetListId);
                const taskIds = Array.isArray(resolved?.taskIds) ? resolved.taskIds : [];
                targetListOrderSource = String(resolved?.source || '').trim();
                targetListDomTaskIds = Array.isArray(resolved?.domTaskIds) ? resolved.domTaskIds : [];
                targetListSqlTaskIds = Array.isArray(resolved?.sqlTaskIds) ? resolved.sqlTaskIds : [];
                const idx = Array.isArray(taskIds) ? taskIds.findIndex((id) => String(id || '').trim() === targetId) : -1;
                if (idx > 0) prevSiblingTaskId = String(taskIds[idx - 1] || '').trim();
            } catch (e) {}
        }
        let childListId = '';
        let firstDirectChildId = '';
        let lastDirectChildId = '';
        let childListOrderSource = '';
        let childListDomTaskIds = [];
        let childListSqlTaskIds = [];
        try { childListId = String(await API.getChildListIdOfTask(targetId) || '').trim(); } catch (e) { childListId = ''; }
        if (childListId) {
            try {
                const fallbackChildTaskIds = (Array.isArray(targetTask.children) ? targetTask.children : [])
                    .map((child) => String(child?.id || '').trim())
                    .filter(Boolean);
                const resolved = await __tmResolveTaskIdsForPlacement(childListId, fallbackChildTaskIds);
                const childTaskIds = Array.isArray(resolved?.taskIds) ? resolved.taskIds : [];
                childListOrderSource = String(resolved?.source || '').trim();
                childListDomTaskIds = Array.isArray(resolved?.domTaskIds) ? resolved.domTaskIds : [];
                childListSqlTaskIds = Array.isArray(resolved?.sqlTaskIds) ? resolved.sqlTaskIds : [];
                if (Array.isArray(childTaskIds) && childTaskIds.length) {
                    firstDirectChildId = String(childTaskIds[0] || '').trim();
                    lastDirectChildId = String(childTaskIds[childTaskIds.length - 1] || '').trim();
                }
            } catch (e) {}
        }
        let targetContentAnchorId = '';
        try {
            const childBlocks = await API.getChildBlocks(targetId);
            const ordered = Array.isArray(childBlocks) ? childBlocks.filter(Boolean) : [];
            const contentBlocks = ordered.filter((block) => String(block?.id || '').trim() && String(block?.id || '').trim() !== childListId);
            const anchorBlock = contentBlocks[contentBlocks.length - 1] || null;
            targetContentAnchorId = String(anchorBlock?.id || '').trim();
        } catch (e) { targetContentAnchorId = ''; }
        return {
            targetTaskId: targetId,
            targetDocId,
            targetParentTaskId: String(targetTask.parentTaskId || '').trim(),
            targetListId,
            targetChildListId: childListId,
            firstDirectChildId,
            prevSiblingTaskId,
            lastDirectChildId,
            targetContentAnchorId,
            targetHeadingId: String(targetTask.h2Id || '').trim(),
            targetHeading: String(targetTask.h2 || '').trim(),
            targetHeadingRank: Number(targetTask.h2Rank),
        };
    }

    async function __tmMoveTaskBeforeTask(taskId, targetTaskId, opts = {}) {
        const id = String(taskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        if (!id || !targetId || id === targetId) return false;
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!sourceTask || !targetTask) return false;
        const meta = await __tmResolveTaskMovePlacementMeta(targetId);
        if (meta.prevSiblingTaskId && meta.prevSiblingTaskId === id) return true;
        if (meta.prevSiblingTaskId) await API.moveBlock(id, { previousID: meta.prevSiblingTaskId });
        else if (meta.targetListId) await API.moveBlock(id, { parentID: meta.targetListId });
        else throw new Error('未找到目标任务所在列表');
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            const docIds = [String(sourceTask.docId || sourceTask.root_id || '').trim(), String(opts.targetDocId || targetTask.docId || targetTask.root_id || '').trim()].filter(Boolean);
            docIds.forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        if (opts.silentHint !== true) hint('✅ 已移动到目标任务前', 'success');
        return true;
    }

    async function __tmMoveTaskAfterTask(taskId, targetTaskId, opts = {}) {
        const id = String(taskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        if (!id || !targetId || id === targetId) return false;
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!sourceTask || !targetTask) return false;
        await API.moveBlock(id, { previousID: targetId });
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            const docIds = [String(sourceTask.docId || sourceTask.root_id || '').trim(), String(opts.targetDocId || targetTask.docId || targetTask.root_id || '').trim()].filter(Boolean);
            docIds.forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        if (opts.silentHint !== true) hint('✅ 已移动到目标任务后', 'success');
        return true;
    }

    async function __tmMoveTaskAsChild(taskId, targetTaskId, opts = {}) {
        const id = String(taskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        if (!id || !targetId || id === targetId) return false;
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!sourceTask || !targetTask) return false;
        const meta = await __tmResolveTaskMovePlacementMeta(targetId);
        if (meta.lastDirectChildId && meta.lastDirectChildId === id && String(sourceTask.parentTaskId || '').trim() === targetId) return true;
        if (meta.lastDirectChildId) await API.moveBlock(id, { previousID: meta.lastDirectChildId });
        else if (meta.targetContentAnchorId) await API.moveBlock(id, { previousID: meta.targetContentAnchorId, parentID: targetId });
        else await API.moveBlock(id, { parentID: targetId });
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            const docIds = [String(sourceTask.docId || sourceTask.root_id || '').trim(), String(opts.targetDocId || targetTask.docId || targetTask.root_id || '').trim()].filter(Boolean);
            docIds.forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try { state.collapsedTaskIds?.delete?.(targetId); } catch (e) {}
        if (opts.silentHint !== true) hint('✅ 已设为子任务', 'success');
        return true;
    }

    async function __tmMoveTaskAsChildTop(taskId, targetTaskId, opts = {}) {
        const id = String(taskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        if (!id || !targetId || id === targetId) return false;
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!sourceTask || !targetTask) return false;
        const meta = await __tmResolveTaskMovePlacementMeta(targetId);
        if (meta.firstDirectChildId && meta.firstDirectChildId === id && String(sourceTask.parentTaskId || '').trim() === targetId) return true;
        if (meta.firstDirectChildId) {
            await API.moveBlock(id, { nextID: meta.firstDirectChildId, parentID: meta.targetChildListId || targetId });
        } else if (meta.targetChildListId) {
            await API.moveBlock(id, { parentID: meta.targetChildListId });
        } else if (meta.targetContentAnchorId) {
            await API.moveBlock(id, { previousID: meta.targetContentAnchorId, parentID: targetId });
        } else {
            await API.moveBlock(id, { parentID: targetId });
        }
        try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e) {}
        try {
            const docIds = [String(sourceTask.docId || sourceTask.root_id || '').trim(), String(opts.targetDocId || targetTask.docId || targetTask.root_id || '').trim()].filter(Boolean);
            docIds.forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try { state.collapsedTaskIds?.delete?.(targetId); } catch (e) {}
        if (opts.silentHint !== true) hint('✅ 已移到子任务首位', 'success');
        return true;
    }

    function __tmClearTaskRowDropIndicators(root = null) {
        const host = root instanceof Element ? root : (state.modal instanceof Element ? state.modal : document);
        try {
            host.querySelectorAll?.('.tm-task-drop--before, .tm-task-drop--after, .tm-task-drop--child, .tm-task-drop--child-top, .tm-task-drop--forbidden')?.forEach?.((el) => {
                try {
                    el.classList.remove('tm-task-drop--before', 'tm-task-drop--after', 'tm-task-drop--child', 'tm-task-drop--child-top', 'tm-task-drop--forbidden');
                    el.style.removeProperty('--tm-task-drop-indent');
                } catch (e) {}
            });
        } catch (e) {}
    }

    function __tmApplyTaskRowDropIndicator(row, kind) {
        const el = row instanceof HTMLElement ? row : null;
        if (!(el instanceof HTMLElement)) return;
        __tmClearTaskRowDropIndicators();
        const dropKind = String(kind || '').trim();
        if (!dropKind) return;
        const depth = Math.max(0, Number(el.getAttribute('data-depth') || 0) || 0);
        const visualDepth = (dropKind === 'child' || dropKind === 'child-top')
            ? (el.classList.contains('tm-task-drop-gap') ? depth : (depth + 1))
            : depth;
        const isTableRow = String(el.tagName || '').toUpperCase() === 'TR';
        const indentBase = isTableRow ? 26 : 30;
        const indentStep = el.classList.contains('tm-checklist-item') && el.closest('.tm-checklist-pane--compact') ? 14 : (isTableRow ? 18 : 22);
        try { el.style.setProperty('--tm-task-drop-indent', `${indentBase + (visualDepth * indentStep)}px`); } catch (e) {}
        el.classList.add(`tm-task-drop--${dropKind}`);
    }

    function __tmTaskHasExpandedVisibleChildren(taskLike) {
        const task = (taskLike && typeof taskLike === 'object')
            ? taskLike
            : (globalThis.__tmRuntimeState?.getFlatTaskById?.(String(taskLike || '').trim()) || state.flatTasks?.[String(taskLike || '').trim()] || null);
        const taskId = String(task?.id || taskLike || '').trim();
        const hasChildren = Array.isArray(task?.children) && task.children.length > 0;
        if (!taskId || !hasChildren) return false;
        try {
            if (state.collapsedTaskIds?.has?.(taskId)) return false;
        } catch (e) {}
        return true;
    }

    function __tmResolveTaskRowDropIntent(ev, row, capabilities) {
        const el = row instanceof HTMLElement ? row : null;
        const caps = (capabilities && typeof capabilities === 'object') ? capabilities : { before: false, child: false, after: false };
        if (!(el instanceof HTMLElement) || !caps.child) return '';
        const targetTaskId = String(el.getAttribute('data-id') || '').trim();
        const expandedChildren = __tmTaskHasExpandedVisibleChildren(targetTaskId);
        if (!caps.before || !caps.after) return 'child';
        const rect = el.getBoundingClientRect();
        const clientY = Number(ev?.clientY);
        if (!Number.isFinite(clientY) || rect.height <= 0) return 'child';
        const ratio = (clientY - rect.top) / Math.max(1, rect.height);
        if (expandedChildren) {
            if (ratio <= 0.28) return 'before';
            if (ratio >= 0.68) return 'child-top';
            return 'child';
        }
        if (ratio <= 0.25) return 'before';
        if (ratio >= 0.75) return 'after';
        return 'child';
    }

    function __tmNormalizeTaskRowDropKind(kind, capabilities) {
        const caps = (capabilities && typeof capabilities === 'object') ? capabilities : { before: false, child: false, after: false };
        const value = String(kind || '').trim();
        if (!caps.child) return '';
        if (value === 'before' || value === 'after') {
            return (caps.before && caps.after) ? value : 'child';
        }
        if (value === 'child' || value === 'child-top') return 'child';
        return 'child';
    }

    async function __tmBuildTaskRowMovePayload(sourceTaskId, targetTaskId, kind) {
        const sourceId = String(sourceTaskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        const moveKind = String(kind || '').trim();
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(sourceId) || state.flatTasks?.[sourceId] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!sourceTask || !targetTask || !sourceId || !targetId || !moveKind) throw new Error('拖拽目标无效');
        const meta = await __tmResolveTaskMovePlacementMeta(targetId);
        return {
            taskId: sourceId,
            targetDocId: meta.targetDocId,
            targetTaskId: targetId,
            targetParentTaskId: (moveKind === 'child' || moveKind === 'child-top') ? targetId : meta.targetParentTaskId,
            targetListId: String(meta.targetListId || '').trim(),
            targetChildListId: String(meta.targetChildListId || '').trim(),
            targetHeadingId: meta.targetHeadingId,
            targetHeading: meta.targetHeading,
            targetHeadingRank: meta.targetHeadingRank,
            targetFirstDirectChildId: meta.firstDirectChildId,
            targetLastDirectChildId: meta.lastDirectChildId,
            prevSiblingTaskId: String(meta.prevSiblingTaskId || '').trim(),
            targetContentAnchorId: String(meta.targetContentAnchorId || '').trim(),
            mode: moveKind,
        };
    }

    function __tmBuildMoveManualRelationships(payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const snapshotTask = data?.snapshot?.task;
        const rootTask = (snapshotTask && typeof snapshotTask === 'object') ? snapshotTask : null;
        const mode = String(data.mode || '').trim();
        if (!rootTask) return null;
        let rootParentTaskId = '';
        if (mode === 'child' || mode === 'child-top') rootParentTaskId = String(data.targetTaskId || '').trim();
        else if (mode === 'before' || mode === 'after') rootParentTaskId = String(data.targetParentTaskId || '').trim();
        else return null;
        const out = new Map();
        const walkChildren = (task) => {
            const parentId = String(task?.id || '').trim();
            if (!parentId) return;
            const children = Array.isArray(task?.children) ? task.children : [];
            children.forEach((child) => {
                const childId = String(child?.id || '').trim();
                if (!childId) return;
                out.set(childId, parentId);
                walkChildren(child);
            });
        };
        const rootId = String(rootTask.id || '').trim();
        if (rootId && rootParentTaskId) out.set(rootId, rootParentTaskId);
        walkChildren(rootTask);
        return out.size ? out : null;
    }

    function __tmBuildMoveInjectedTasks(payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const snapshotTask = data?.snapshot?.task;
        const rootTask = (snapshotTask && typeof snapshotTask === 'object') ? snapshotTask : null;
        if (!rootTask) return null;
        let cloned = null;
        try {
            cloned = JSON.parse(JSON.stringify(rootTask));
        } catch (e) {
            cloned = null;
        }
        if (!cloned || typeof cloned !== 'object') return null;
        try { __tmApplyMovePayloadToTaskRecursive(cloned, data, true); } catch (e) {}
        const out = [];
        const flatten = (task) => {
            if (!task || typeof task !== 'object') return;
            const item = { ...task };
            item.children = [];
            out.push(item);
            (Array.isArray(task.children) ? task.children : []).forEach((child) => flatten(child));
        };
        flatten(cloned);
        return out.length ? out : null;
    }

    function __tmCollectMoveSuppressionIds(payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const snapshotTask = data?.snapshot?.task;
        const rootTask = (snapshotTask && typeof snapshotTask === 'object') ? snapshotTask : null;
        const blockIds = new Set();
        const docIds = new Set();
        const walk = (task) => {
            if (!task || typeof task !== 'object') return;
            const taskId = String(task.id || '').trim();
            if (taskId) blockIds.add(taskId);
            const docId = String(task.root_id || task.docId || '').trim();
            if (docId) docIds.add(docId);
            (Array.isArray(task.children) ? task.children : []).forEach((child) => walk(child));
        };
        walk(rootTask);
        const targetTaskId = String(data.targetTaskId || '').trim();
        const targetDocId = String(data.targetDocId || '').trim();
        const targetParentTaskId = String(data.targetParentTaskId || '').trim();
        if (targetTaskId) blockIds.add(targetTaskId);
        if (targetParentTaskId) blockIds.add(targetParentTaskId);
        if (targetDocId) docIds.add(targetDocId);
        return {
            blockIds: Array.from(blockIds),
            docIds: Array.from(docIds),
        };
    }

    function __tmCanHandleTaskRowDrop(sourceTaskId, targetTaskId) {
        const sourceId = String(sourceTaskId || '').trim();
        const targetId = String(targetTaskId || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) return { ok: false, reason: 'same' };
        if (!__tmCanCreateChildTaskByDrag()) return { ok: false, reason: 'group' };
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(sourceId) || state.flatTasks?.[sourceId] || null;
        const targetTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(targetId) || state.flatTasks?.[targetId] || null;
        if (!__tmTaskSupportsRowDrop(sourceTask) || !__tmTaskSupportsRowDrop(targetTask)) return { ok: false, reason: 'readonly' };
        if (__tmIsTaskInSubtree(sourceTask, targetId)) return { ok: false, reason: 'cycle' };
        return { ok: true };
    }

    async function __tmHandleTaskRowDropCore(ev, targetTaskId, overrideKind = '') {
        const targetId = String(targetTaskId || '').trim();
        const sourceTaskId = __tmGetDraggedTaskId(ev);
        if (!sourceTaskId || !targetId) return null;
        const validation = __tmCanHandleTaskRowDrop(sourceTaskId, targetId);
        const row = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') : null);
        const capabilities = __tmGetTaskDropCapabilities();
        const kind = __tmNormalizeTaskRowDropKind(overrideKind || __tmResolveTaskRowDropIntent(ev, row, capabilities), capabilities);
        if (!validation.ok || !kind) {
            if (row instanceof HTMLElement) __tmApplyTaskRowDropIndicator(row, 'forbidden');
            return null;
        }
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(sourceTaskId || '').trim()) || state.flatTasks?.[String(sourceTaskId || '').trim()] || null;
        if (!__tmEnsureEditableTaskLike(sourceTask, '拖拽移动')) return null;
        const payload = await __tmBuildTaskRowMovePayload(sourceTaskId, targetId, kind);
        await __tmQueueMoveTask(sourceTaskId, payload);
        if (kind === 'child') {
            try { state.collapsedTaskIds?.delete?.(targetId); } catch (e) {}
        }
        return { kind, payload };
    }

    let __tmTaskRowDropReconcileSeq = 0;
    const __tmTaskRowDropReconcileTimers = new Set();

    function __tmClearTaskRowDropReconcileTimers() {
        try {
            __tmTaskRowDropReconcileTimers.forEach((timerId) => {
                try { clearTimeout(timerId); } catch (e) {}
            });
            __tmTaskRowDropReconcileTimers.clear();
        } catch (e) {}
    }

    function __tmScheduleTaskRowDropReconcileRefresh(payload = null) {
        const data = (payload && typeof payload === 'object') ? payload : null;
        __tmTaskRowDropReconcileSeq += 1;
        const seq = __tmTaskRowDropReconcileSeq;
        __tmClearTaskRowDropReconcileTimers();
        const invalidateAffectedDocCaches = () => {
            try {
                const docIds = [
                    String(data?.targetDocId || '').trim(),
                    String(data?.snapshot?.docId || '').trim(),
                ].filter(Boolean);
                docIds.forEach((docId) => {
                    try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
                });
            } catch (e) {}
        };
        const runProtectedRefresh = async () => {
            try {
                const targetDocId = String(data?.targetDocId || '').trim();
                const sourceDocId = String(data?.snapshot?.docId || '').trim();
                const expectId = String(data?.taskId || '').trim();
                const manualRelationships = __tmBuildMoveManualRelationships(data);
                const injectedTasks = __tmBuildMoveInjectedTasks(data);
                invalidateAffectedDocCaches();
                if (targetDocId) {
                    await reloadDocTasksProtected(targetDocId, expectId || null, manualRelationships, injectedTasks, {
                        applyFilters: false,
                        render: false,
                        saveMeta: false,
                        forceDocFlowOrder: true,
                    });
                    if (sourceDocId && sourceDocId !== targetDocId) {
                        await reloadDocTasksProtected(sourceDocId, null, null, null, {
                            applyFilters: false,
                            render: false,
                            saveMeta: false,
                            forceDocFlowOrder: true,
                        });
                    }
                    try { recalcStats(); } catch (e) {}
                    try { applyFilters(); } catch (e) {}
                    try { render(); } catch (e) {}
                    return;
                }
                await __tmLoadSelectedDocumentsPreserveChecklistScroll({
                    source: 'task-row-drop-reconcile',
                    forceSyncFlowRank: true,
                });
            } catch (e) {
                try { __tmRefreshMainViewInPlace({ withFilters: true, reason: 'task-row-drop-reconcile-fallback' }); } catch (e2) {}
            }
        };
        const runFullRefresh = async (reason = '') => {
            try {
                invalidateAffectedDocCaches();
                await __tmLoadSelectedDocumentsPreserveChecklistScroll({
                    source: String(reason || 'task-row-drop-reconcile-full').trim() || 'task-row-drop-reconcile-full',
                    showInlineLoading: false,
                    // The protected reload can briefly cache pre-index SQL rows. Force the
                    // follow-up full load to fetch fresh rows instead of replaying them.
                    forceFreshTasks: true,
                    forceSyncFlowRank: true,
                });
            } catch (e) {
                try { __tmRefreshMainViewInPlace({ withFilters: true, reason: 'task-row-drop-full-refresh-fallback' }); } catch (e2) {}
            }
        };
        const schedule = (delayMs, fn) => {
            try {
                const timerId = setTimeout(() => {
                    try { __tmTaskRowDropReconcileTimers.delete(timerId); } catch (e) {}
                    if (seq !== __tmTaskRowDropReconcileSeq) return;
                    void fn();
                }, delayMs);
                __tmTaskRowDropReconcileTimers.add(timerId);
            } catch (e) {}
        };
        schedule(280, runProtectedRefresh);
        schedule(960, runProtectedRefresh);
        schedule(2200, () => runFullRefresh('task-row-drop-reconcile-full'));
    }

    window.tmTaskRowDragOver = function(ev, targetTaskId) {
        const overrideKind = String(arguments?.[2] || '').trim();
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
        } catch (e) {}
        const targetId = String(targetTaskId || '').trim();
        const sourceTaskId = __tmGetDraggedTaskId(ev);
        const row = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') : null);
        if (!(row instanceof HTMLElement) || !targetId || !sourceTaskId) {
            __tmClearTaskRowDropIndicators();
            return false;
        }
        const validation = __tmCanHandleTaskRowDrop(sourceTaskId, targetId);
        if (!validation.ok) {
            __tmApplyTaskRowDropIndicator(row, 'forbidden');
            return false;
        }
        const capabilities = __tmGetTaskDropCapabilities();
        const kind = __tmNormalizeTaskRowDropKind(overrideKind || __tmResolveTaskRowDropIntent(ev, row, capabilities), capabilities);
        __tmApplyTaskRowDropIndicator(row, kind || 'child');
        try {
            if (kind === 'child') state.collapsedTaskIds?.delete?.(targetId);
        } catch (e) {}
        return false;
    };

    window.tmTaskRowDragLeave = function(ev) {
        const row = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        if (!(row instanceof HTMLElement)) return;
        try {
            const related = ev?.relatedTarget instanceof Node ? ev.relatedTarget : null;
            if (related && row.contains(related)) return;
        } catch (e) {}
        try {
            row.classList.remove('tm-task-drop--before', 'tm-task-drop--after', 'tm-task-drop--child', 'tm-task-drop--child-top', 'tm-task-drop--forbidden');
            row.style.removeProperty('--tm-task-drop-indent');
        } catch (e) {}
    };

    window.tmTaskRowDrop = async function(ev, targetTaskId, overrideKind = '') {
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
        } catch (e) {}
        try {
            const result = await __tmHandleTaskRowDropCore(ev, targetTaskId, overrideKind);
            const moveKind = String(result?.kind || '').trim();
            if (moveKind) {
                const successText = moveKind === 'before'
                    ? '✅ 已移动到目标任务前'
                    : (moveKind === 'after'
                        ? '✅ 已移动到目标任务后'
                        : '✅ 已设为子任务');
                hint(successText, 'success');
            }
        } catch (e) {
            hint(`❌ 移动失败: ${e.message}`, 'error');
        } finally {
            __tmClearTaskRowDropIndicators();
        }
    };

    window.tmDocTabDrop = async function(ev, docId) {
        try {
            ev.preventDefault?.();
            ev.stopPropagation?.();
        } catch (e) {}
        state.suppressDocTabClickUntil = Date.now() + 300;
        // 移除所有文档页签的drop目标样式
        try {
            const tabEls = document.querySelectorAll('.tm-doc-tab.is-drop-target');
            tabEls.forEach(el => el.classList.remove('is-drop-target'));
        } catch (e) {}
        try { __tmClearDocTabDropTarget(); } catch (e) {}
        // 如果docId为空，尝试从事件目标获取
        let targetDocId = String(docId || '').trim();
        if (!targetDocId) {
            const tabEl = ev.target instanceof Element ? ev.target.closest('.tm-doc-tab') : null;
            if (tabEl) {
                targetDocId = String(tabEl.getAttribute('data-tm-doc-id') || '').trim();
            }
        }
        if (!targetDocId || targetDocId === 'all') return;
        const taskId = __tmGetDraggedTaskId(ev);
        if (!taskId) return;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks?.[taskId];
        if (!task) return;
        const fromDocId = String(task.docId || task.root_id || '').trim();
        if (fromDocId && fromDocId === targetDocId) return;
        try {
            hint('🔄 正在移动任务...', 'info');
            await __tmQueueMoveTask(taskId, { targetDocId, mode: 'doc' });
            hint('✅ 任务已移动', 'success');
            __tmRefreshMainViewInPlace({ withFilters: true });
        } catch (e) {
            hint(`❌ 移动失败: ${e.message}`, 'error');
        }
    };

    window.tmDragTaskStart = function(ev, taskId) {
        const id = String(taskId || '').trim();
        if (!id) return;
        if (__tmIsMultiSelectActive()) {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            state.draggingTaskId = '';
            return;
        }
        state.draggingTaskId = id;
        let meta = null;
        try {
            if (typeof window.tmCalendarGetTaskDragMeta === 'function') {
                meta = window.tmCalendarGetTaskDragMeta(id);
            }
        } catch (e) {}
        const calendarId = String(meta?.calendarId || '').trim();
        const durationMin = Number(meta?.durationMin);
        const title = String(meta?.title || '').trim();
        try {
            const row = (ev?.currentTarget instanceof Element)
                ? ev.currentTarget.closest?.('tr[data-id], .tm-checklist-item[data-id], .tm-kanban-card[data-id], .tm-whiteboard-pool-item[data-task-id], .tm-whiteboard-node[data-task-id], .tm-whiteboard-stream-task-head[data-task-id], .tm-whiteboard-stream-task-node[data-task-id]')
                : null;
            if (row && calendarId) row.setAttribute('data-calendar-id', calendarId);
        } catch (e) {}
        try {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('application/x-tm-task-id', id);
            ev.dataTransfer.setData('application/x-tm-task', JSON.stringify({
                id,
                title: title || id,
                durationMin: (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60,
                calendarId: calendarId || 'default',
                startDate: String(meta?.startDate || '').trim(),
                completionTime: String(meta?.completionTime || '').trim(),
            }));
            ev.dataTransfer.setData('text/plain', id);
        } catch (e) {}
        try {
            const sourceEl = ev?.currentTarget instanceof Element ? ev.currentTarget : (ev?.target instanceof Element ? ev.target : null);
            const shouldSuppressFloatingMini = !!sourceEl?.closest?.('.tm-calendar-sidebar, [data-tm-cal-role="task-page-list"], [data-tm-cal-role="task-list"], .tm-cal-task[data-task-id]');
            if (!shouldSuppressFloatingMini) {
                __tmCalendarFloatingDragStart(id, meta, ev);
            }
        } catch (e) {}
        try { state.modal?.classList?.add?.('tm-task-drag-active'); } catch (e) {}
    };

    window.tmDragTaskEnd = function() {
        state.draggingTaskId = '';
        try { __tmClearDocTabDropTarget(); } catch (e) {}
        try { __tmClearTaskRowDropIndicators(); } catch (e) {}
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        try { state.modal?.classList?.remove?.('tm-task-drag-active'); } catch (e) {}
    };

    function __tmDockPointerTaskDragIsEnabled() {
        return globalThis.__tmViewPolicy?.shouldUseDockPointerTaskDrag?.()
            ?? (globalThis.__tmRuntimeHost?.isDesktopDockHost?.() ?? (__tmIsDockHost() && !__tmIsRuntimeMobileClient()));
    }

    function __tmResolveDockPointerTaskDragSource(target) {
        const el = target instanceof Element ? target : null;
        if (!(el instanceof Element)) return null;
        const candidate = el.closest('.tm-kanban-card[data-id], .tm-checklist-item[data-id], #tmTimelineLeftTable tbody tr[data-id], #tmTaskTable tbody tr[data-id]');
        if (!(candidate instanceof HTMLElement)) return null;
        const taskId = String(candidate.getAttribute('data-id') || candidate.getAttribute('data-task-id') || '').trim();
        if (!taskId) return null;
        const isKanban = candidate.classList.contains('tm-kanban-card');
        const skipSelector = isKanban
            ? 'input,button,select,textarea,a,label,[contenteditable="true"],.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle,.tm-kanban-more,.tm-status-tag,.tm-kanban-chip,.tm-priority-jira,.tm-kanban-priority-chip'
            : 'input,button,select,textarea,a,label,[contenteditable="true"],.tm-tree-toggle,.tm-col-resize,.tm-checklist-mobile-toggle,.tm-status-tag';
        if (el.closest(skipSelector)) return null;
        return {
            taskId,
            sourceEl: candidate,
            sourceType: isKanban ? 'kanban' : 'task',
        };
    }

    function __tmBuildDockPointerTaskDragPayload(taskId, meta) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        let nextMeta = (meta && typeof meta === 'object') ? meta : null;
        if (!nextMeta && typeof window.tmCalendarGetTaskDragMeta === 'function') {
            try { nextMeta = window.tmCalendarGetTaskDragMeta(id); } catch (e) {}
        }
        const safeMeta = (nextMeta && typeof nextMeta === 'object') ? nextMeta : {};
        const durationMin = Number(safeMeta.durationMin);
        const title = String(
            safeMeta.title
            || globalThis.__tmRuntimeState?.getFlatTaskById?.(id)?.content
            || state.flatTasks?.[id]?.content
            || id
        ).trim() || id;
        return {
            taskId: id,
            id,
            title,
            durationMin: (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60,
            calendarId: String(safeMeta.calendarId || 'default').trim() || 'default',
            startDate: String(safeMeta.startDate || '').trim(),
            completionTime: String(safeMeta.completionTime || '').trim(),
        };
    }

    function __tmBuildDockPointerTaskSyntheticTransfer(payload) {
        const safePayload = (payload && typeof payload === 'object') ? payload : {};
        const taskId = String(safePayload.taskId || safePayload.id || '').trim();
        const json = JSON.stringify({
            id: taskId,
            title: String(safePayload.title || taskId || '任务').trim() || '任务',
            durationMin: Number(safePayload.durationMin) || 60,
            calendarId: String(safePayload.calendarId || 'default').trim() || 'default',
            startDate: String(safePayload.startDate || '').trim(),
            completionTime: String(safePayload.completionTime || '').trim(),
        });
        return {
            dropEffect: 'move',
            effectAllowed: 'move',
            getData(type) {
                const key = String(type || '').trim();
                if (key === 'application/x-tm-task-id' || key === 'text/plain') return taskId;
                if (key === 'application/x-tm-task') return json;
                return '';
            },
            setData() {},
            setDragImage() {},
        };
    }

    function __tmBuildDockPointerTaskGhost(taskId, sourceEl, payload, clientX, clientY) {
        if (!(sourceEl instanceof HTMLElement)) return null;
        const rect = sourceEl.getBoundingClientRect();
        const resolvedTaskId = String(taskId || '').trim();
        const title = String(
            payload?.title
            || globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedTaskId)?.content
            || state.flatTasks?.[resolvedTaskId]?.content
            || taskId
            || '任务'
        ).trim() || '任务';
        const dateText = String(payload?.completionTime || '').trim();
        const ghost = document.createElement('div');
        ghost.className = 'tm-dock-pointer-task-ghost';
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';
        ghost.style.margin = '0';
        ghost.style.padding = dateText ? '10px 12px' : '12px';
        ghost.style.minWidth = '180px';
        ghost.style.maxWidth = '320px';
        ghost.style.width = `${Math.max(180, Math.min(320, Math.round(rect.width || sourceEl.offsetWidth || 240)))}px`;
        ghost.style.borderRadius = '14px';
        ghost.style.border = '1px solid color-mix(in srgb, var(--tm-border-color, #d0d7de) 82%, var(--tm-primary-color, #4f8cff) 18%)';
        ghost.style.background = 'color-mix(in srgb, var(--b3-theme-surface, #ffffff) 90%, var(--tm-primary-color, #4f8cff) 10%)';
        ghost.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.22)';
        ghost.style.color = 'var(--tm-text-color, var(--b3-theme-on-background, #111827))';
        ghost.style.pointerEvents = 'none';
        ghost.style.userSelect = 'none';
        ghost.style.zIndex = '200160';
        ghost.style.opacity = '0.4';
        ghost.style.backdropFilter = 'blur(10px)';
        ghost.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
        const titleEl = document.createElement('div');
        titleEl.style.fontSize = '13px';
        titleEl.style.fontWeight = '700';
        titleEl.style.lineHeight = '1.4';
        titleEl.style.wordBreak = 'break-word';
        titleEl.textContent = title;
        ghost.appendChild(titleEl);
        if (dateText) {
            const dateEl = document.createElement('div');
            dateEl.style.marginTop = '6px';
            dateEl.style.fontSize = '11px';
            dateEl.style.opacity = '0.78';
            dateEl.textContent = `当前截止日期 ${dateText}`;
            ghost.appendChild(dateEl);
        }
        try { document.body.appendChild(ghost); } catch (e) { return null; }
        const width = Math.max(180, Math.min(320, Math.round(rect.width || sourceEl.offsetWidth || 240)));
        const clamp0 = (n, min, max) => Math.max(min, Math.min(max, n));
        const offsetX = clamp0((Number(clientX) || rect.left) - rect.left, 18, Math.max(18, width - 18));
        const offsetY = clamp0((Number(clientY) || rect.top) - rect.top, 12, Math.max(12, Math.round(Math.max(44, rect.height || sourceEl.offsetHeight || 44)) - 12));
        return { ghost, offsetX, offsetY };
    }

    function __tmPlaceDockPointerTaskGhost(meta, clientX, clientY) {
        if (!(meta?.ghost instanceof HTMLElement)) return;
        const left = Math.round((Number(clientX) || 0) - (Number(meta.offsetX) || 0));
        const top = Math.round((Number(clientY) || 0) - (Number(meta.offsetY) || 0));
        try { meta.ghost.style.transform = `translate(${left}px, ${top}px)`; } catch (e) {}
    }

    function __tmSuppressDockPointerTaskClick(ms = 260) {
        const timeout = Math.max(0, Number(ms) || 0);
        if (!timeout) return 0;
        const until = Date.now() + timeout;
        state.dockTaskPointerSuppressClickUntil = Math.max(Number(state.dockTaskPointerSuppressClickUntil || 0), until);
        return until;
    }

    function __tmConsumeDockPointerSuppressedClick(event) {
        if (Number(state.dockTaskPointerSuppressClickUntil || 0) <= Date.now()) return false;
        state.dockTaskPointerSuppressClickUntil = 0;
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}
        return true;
    }

    function __tmBindDockPointerTaskDrag(modalEl) {
        try { state.dockTaskPointerDragAbort?.abort?.(); } catch (e) {}
        state.dockTaskPointerDragAbort = null;
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        if (!__tmDockPointerTaskDragIsEnabled()) return;
        if (globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar')) return;
        if (__tmIsMultiSelectActive()) return;
        const abort = new AbortController();
        state.dockTaskPointerDragAbort = abort;

        modal.addEventListener('click', (ev) => {
            __tmConsumeDockPointerSuppressedClick(ev);
        }, { capture: true, signal: abort.signal });

        modal.addEventListener('dragstart', (ev) => {
            if (!__tmDockPointerTaskDragIsEnabled()) return;
            const source = __tmResolveDockPointerTaskDragSource(ev?.target);
            if (!source) return;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
        }, { capture: true, signal: abort.signal });

        modal.addEventListener('contextmenu', (ev) => {
            if (!__tmDockPointerTaskDragIsEnabled()) return;
            if (!(globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist'))) return;
            const source = __tmResolveDockPointerTaskDragSource(ev?.target);
            if (!source || String(source.sourceType || '').trim() !== 'task') return;
            try {
                window.tmShowTaskContextMenu?.(ev, source.taskId);
            } catch (e) {}
        }, { capture: true, signal: abort.signal });

        modal.addEventListener('pointerdown', (ev) => {
            if (!__tmDockPointerTaskDragIsEnabled()) return;
            if (globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar')) return;
            if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
            const pointerType = String(ev?.pointerType || '').trim().toLowerCase();
            if (pointerType === 'touch') return;
            const source = __tmResolveDockPointerTaskDragSource(ev?.target);
            if (!source) return;

            try { state.dockTaskPointerGestureCleanup?.(); } catch (e) {}

            const taskId = String(source.taskId || '').trim();
            const sourceEl = source.sourceEl instanceof HTMLElement ? source.sourceEl : null;
            const sourceType = String(source.sourceType || 'task').trim() || 'task';
            if (!taskId || !(sourceEl instanceof HTMLElement)) return;

            let dragMeta = null;
            try {
                if (typeof window.tmCalendarGetTaskDragMeta === 'function') {
                    dragMeta = window.tmCalendarGetTaskDragMeta(taskId);
                }
            } catch (e) {}
            const payload = __tmBuildDockPointerTaskDragPayload(taskId, dragMeta);
            const syntheticTransfer = __tmBuildDockPointerTaskSyntheticTransfer(payload);
            const threshold = sourceType === 'kanban' ? 6 : 4;
            const suppressClickMs = 260;
            const floatingMiniMode = __tmGetFloatingMiniDragMode();
            const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : NaN;
            const startX = Number(ev?.clientX) || 0;
            const startY = Number(ev?.clientY) || 0;
            let lastX = startX;
            let lastY = startY;
            let dragging = false;
            let completing = false;
            let ended = false;
            let captured = false;
            let ghostMeta = null;
            const prevOpacity = String(sourceEl.style.opacity || '');
            const resolvePointTarget = (x, y) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                try {
                    const hit = document.elementFromPoint(x, y);
                    return hit instanceof Element ? hit : null;
                } catch (e) {
                    return null;
                }
            };
            const samePointer = (e2) => {
                if (!Number.isFinite(pointerId)) return true;
                const cur = Number(e2?.pointerId);
                if (!Number.isFinite(cur)) return true;
                return cur === pointerId;
            };
            const capturePointer = () => {
                if (captured || !Number.isFinite(pointerId) || typeof sourceEl.setPointerCapture !== 'function') return;
                try {
                    sourceEl.setPointerCapture(pointerId);
                    captured = true;
                } catch (e) {}
            };
            const clearKanbanHover = () => {
                if (sourceType !== 'kanban') return;
                try { __tmKanbanClearDragOver(); } catch (e) {}
            };
            const clearDocHover = () => {
                try { __tmClearDocTabDropTarget(); } catch (e) {}
            };
            const clearTaskRowHover = () => {
                try { __tmClearTaskRowDropIndicators(); } catch (e) {}
            };
            const syncHover = () => {
                const pointTarget = resolvePointTarget(lastX, lastY);
                const floatingInfo = __tmCalendarFloatingDragMove({
                    clientX: lastX,
                    clientY: lastY,
                    target: pointTarget || sourceEl,
                }, { mode: floatingMiniMode });
                if (floatingInfo?.overFloatingMini) {
                    clearDocHover();
                    clearKanbanHover();
                    clearTaskRowHover();
                    return;
                }
                const docTabEl = pointTarget?.closest?.('.tm-doc-tab') || null;
                if (docTabEl instanceof Element) {
                    try {
                        window.tmDocTabDragOver?.({
                            preventDefault() {},
                            stopPropagation() {},
                            dataTransfer: syntheticTransfer,
                            target: docTabEl,
                            currentTarget: docTabEl,
                        });
                    } catch (e) {}
                } else {
                    clearDocHover();
                }
                const taskRowEl = pointTarget?.closest?.('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') || null;
                if (taskRowEl instanceof HTMLElement) {
                    try {
                        window.tmTaskRowDragOver?.({
                            preventDefault() {},
                            stopPropagation() {},
                            clientY: lastY,
                            dataTransfer: syntheticTransfer,
                            target: pointTarget || taskRowEl,
                            currentTarget: taskRowEl,
                        }, String(taskRowEl.getAttribute('data-id') || '').trim());
                    } catch (e) {}
                } else {
                    clearTaskRowHover();
                }
                if (sourceType === 'kanban') {
                    try { __tmApplyKanbanDragHoverFromTarget(pointTarget); } catch (e) {}
                }
            };
            const cleanup = (suppressClick) => {
                if (ended) return;
                ended = true;
                try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
                try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
                try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
                try { window.removeEventListener('blur', onUp, true); } catch (e) {}
                if (captured && Number.isFinite(pointerId) && typeof sourceEl.releasePointerCapture === 'function') {
                    try { sourceEl.releasePointerCapture(pointerId); } catch (e) {}
                }
                if (ghostMeta?.ghost instanceof HTMLElement) {
                    try { ghostMeta.ghost.remove(); } catch (e) {}
                }
                try { sourceEl.style.opacity = prevOpacity; } catch (e) {}
                if (sourceType === 'kanban') {
                    try { sourceEl.classList.remove('tm-kanban-card--dragging'); } catch (e) {}
                    try { delete state.__tmKanbanDragId; } catch (e) {}
                    try { delete state.__tmKanbanDragIds; } catch (e) {}
                }
                clearDocHover();
                clearKanbanHover();
                clearTaskRowHover();
                try { __tmSetCalendarSideDockDragHidden(false); } catch (e) {}
                try { __tmCalendarFloatingDragEnd(); } catch (e) {}
                if (String(state.draggingTaskId || '').trim() === taskId) state.draggingTaskId = '';
                try { document.body.style.userSelect = ''; } catch (e) {}
                try { document.body.style.cursor = ''; } catch (e) {}
                if (suppressClick) {
                    __tmSuppressDockPointerTaskClick(suppressClickMs);
                }
                if (state.dockTaskPointerGestureCleanup === cleanup) state.dockTaskPointerGestureCleanup = null;
            };
            const finishDrop = async () => {
                const pointTarget = resolvePointTarget(lastX, lastY);
                try {
                    const handled = await globalThis.__tmCalendar?.finalizeFloatingMiniCalendarTouchDrop?.({
                        taskId,
                        clientX: lastX,
                        clientY: lastY,
                        target: pointTarget,
                        mode: floatingMiniMode,
                    });
                    if (handled) return true;
                } catch (e) {}
                const docTabEl = pointTarget?.closest?.('.tm-doc-tab') || null;
                if (docTabEl instanceof Element) {
                    try {
                        await window.tmDocTabDrop?.({
                            preventDefault() {},
                            stopPropagation() {},
                            dataTransfer: syntheticTransfer,
                            target: docTabEl,
                            currentTarget: docTabEl,
                        }, String(docTabEl.getAttribute('data-tm-doc-id') || '').trim());
                        return true;
                    } catch (e) {}
                }
                const taskRowEl = pointTarget?.closest?.('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') || null;
                if (taskRowEl instanceof HTMLElement) {
                    try {
                        await window.tmTaskRowDrop?.({
                            preventDefault() {},
                            stopPropagation() {},
                            clientY: lastY,
                            dataTransfer: syntheticTransfer,
                            target: pointTarget || taskRowEl,
                            currentTarget: taskRowEl,
                        }, String(taskRowEl.getAttribute('data-id') || '').trim());
                        return true;
                    } catch (e) {}
                }
                if (sourceType === 'kanban') {
                    const dropHost = pointTarget?.closest?.('.tm-kanban-group-title, .tm-kanban-group, .tm-kanban-col') || null;
                    if (dropHost instanceof Element) {
                        try {
                            const ret = window.tmKanbanDrop?.({
                                preventDefault() {},
                                stopPropagation() {},
                                target: dropHost,
                                currentTarget: dropHost,
                                dataTransfer: syntheticTransfer,
                            });
                            if (ret && typeof ret.then === 'function') await ret;
                            return true;
                        } catch (e) {}
                    }
                }
                return false;
            };
            const startDrag = () => {
                if (dragging || ended) return;
                dragging = true;
                capturePointer();
                state.draggingTaskId = taskId;
                if (sourceType === 'kanban') {
                    state.__tmKanbanDragId = taskId;
                    state.__tmKanbanDragIds = [taskId];
                    try { sourceEl.classList.add('tm-kanban-card--dragging'); } catch (e) {}
                }
                try { __tmSetCalendarSideDockDragHidden(true); } catch (e) {}
                try {
                    sourceEl.style.opacity = '0.72';
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'grabbing';
                } catch (e) {}
                ghostMeta = __tmBuildDockPointerTaskGhost(taskId, sourceEl, payload, lastX, lastY);
                try {
                    const dockModalRect = __tmIsDockHost() && state.modal?.getBoundingClientRect
                        ? state.modal.getBoundingClientRect()
                        : null;
                    __tmCalendarFloatingDragStart(taskId, dragMeta, {
                        clientX: lastX,
                        clientY: lastY,
                        target: sourceEl,
                    }, {
                        mode: floatingMiniMode,
                        html5: false,
                        containerRect: dockModalRect,
                    });
                } catch (e) {}
                syncHover();
            };
            const onMove = (e2) => {
                if (ended || completing || !samePointer(e2)) return;
                lastX = Number(e2?.clientX) || lastX;
                lastY = Number(e2?.clientY) || lastY;
                if (!dragging) {
                    const dx = lastX - startX;
                    const dy = lastY - startY;
                    if ((dx * dx + dy * dy) < (threshold * threshold)) return;
                    startDrag();
                }
                __tmPlaceDockPointerTaskGhost(ghostMeta, lastX, lastY);
                syncHover();
                try { e2.preventDefault(); } catch (e) {}
            };
            const onUp = async (e2) => {
                if (ended || completing || !samePointer(e2)) return;
                completing = true;
                try {
                    if (dragging) {
                        __tmSuppressDockPointerTaskClick(suppressClickMs);
                        lastX = Number(e2?.clientX) || lastX;
                        lastY = Number(e2?.clientY) || lastY;
                        await finishDrop();
                    }
                } finally {
                    cleanup(dragging);
                }
            };

            state.dockTaskPointerGestureCleanup = () => cleanup(false);
            document.addEventListener('pointermove', onMove, true);
            document.addEventListener('pointerup', onUp, true);
            document.addEventListener('pointercancel', onUp, true);
            window.addEventListener('blur', onUp, true);
        }, { capture: true, passive: false, signal: abort.signal });
    }

    window.tmRowClick = async function(ev, taskId) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        const t = ev?.target;
        if (__tmIsMultiSelectActive()) {
            if (t?.closest?.('button,input,select,textarea,a,.tm-tree-toggle,.tm-col-resize')) return;
            __tmToggleTaskMultiSelection(id);
            return;
        }
        if (t?.closest?.('button,input,select,textarea,a,.tm-task-content-clickable,.tm-tree-toggle,.tm-col-resize,.tm-cell-editable,.tm-status-cell')) return;
        if (globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist')) {
            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) {
                try { await __tmWarmKanbanDocHeadings([docId], { force: true }); } catch (e) {}
            }
            state.detailTaskId = id;
            if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'row-click')) render();
            return;
        }
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const hasChild = Array.isArray(task.children) && task.children.length > 0;
        if (!hasChild) return;
        tmToggleCollapse(id, ev);
    };

    window.tmChecklistSelectTask = async function(taskId, ev) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        const target = ev?.target;
        if (target?.closest?.('input,button,select,textarea,a,.tm-tree-toggle,.tm-task-checkbox,.tm-task-checkbox-wrap')) return;
        if (__tmIsMultiSelectActive('checklist')) {
            __tmToggleTaskMultiSelection(id);
            return;
        }
        const prevSelectedId = String(state.detailTaskId || '').trim();
        if (prevSelectedId && prevSelectedId !== id) {
            try {
                const detailPanel = state.modal?.querySelector?.('#tmChecklistSheetPanel, #tmChecklistDetailPanel');
                if (detailPanel instanceof HTMLElement) {
                    await detailPanel.__tmTaskDetailFlushSave?.({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: false,
                        skipRerender: true,
                    });
                }
            } catch (e) {}
        }
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        const docId = String(task?.root_id || task?.docId || '').trim();
        if (docId) {
            try { await __tmWarmKanbanDocHeadings([docId], { force: true }); } catch (e) {}
        }
        state.detailTaskId = id;
        state.checklistDetailDismissed = false;
        if (__tmChecklistUseSheetMode(state.modal)) state.checklistDetailSheetOpen = true;
        const refreshed = __tmRefreshChecklistSelectionInPlace(state.modal, 'checklist-select');
        if (!refreshed) render();
    };

    function __tmIsTouchLikeChecklistPointer(ev) {
        const pType = String(ev?.pointerType || '').trim().toLowerCase();
        if (__tmShouldUseCustomTouchTaskDrag()) return true;
        return pType === 'touch' || pType === 'pen' || (!pType && __tmIsRuntimeMobileClient());
    }

    function __tmResolveTouchTaskDragSource(ev, taskId) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        const sourceEl = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget.closest('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]')
            : (ev?.target instanceof Element ? ev.target.closest('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') : null);
        if (!(sourceEl instanceof HTMLElement)) return null;
        const sourceType = String(sourceEl.tagName || '').toUpperCase() === 'TR' ? 'table' : 'checklist';
        return { taskId: id, sourceEl, sourceType };
    }

    function __tmStartTouchTaskDrag(ev, taskId) {
        if (!__tmShouldUseCustomTouchTaskDrag()) return false;
        if (__tmIsMultiSelectActive()) return false;
        if (!__tmIsTouchLikeChecklistPointer(ev)) return false;
        if (ev && typeof ev.button === 'number' && ev.button !== 0) return false;
        try { ev?.preventDefault?.(); } catch (e) {}
        const source = __tmResolveTouchTaskDragSource(ev, taskId);
        if (!source) return false;
        const target = ev?.target;
        const sourceType = String(source.sourceType || 'checklist').trim() || 'checklist';
        const blockedSelector = sourceType === 'table'
            ? 'input,button,select,textarea,a,.tm-tree-toggle,.tm-col-resize,.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-status-tag'
            : 'input,button,select,textarea,a,.tm-tree-toggle,.tm-checklist-mobile-toggle,.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-status-tag';
        if (target?.closest?.(blockedSelector)) {
            return false;
        }

        const id = source.taskId;
        const sourceEl = source.sourceEl;
        const activeEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        let dragMeta = null;
        try {
            if (typeof window.tmCalendarGetTaskDragMeta === 'function') {
                dragMeta = window.tmCalendarGetTaskDragMeta(id);
            }
        } catch (e) {}
        const payload = __tmBuildDockPointerTaskDragPayload(id, dragMeta);
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : NaN;
        const startX = Number(ev?.clientX) || 0;
        const startY = Number(ev?.clientY) || 0;
        const longPressMs = 340;
        const longPressMoveTolerance = 14;
        const floatingMiniRevealDistance = 18;
        const floatingMiniRevealDelayMs = 120;
        const shouldRevealFloatingMiniImmediately = true;
        let lastX = startX;
        let lastY = startY;
        let ended = false;
        let dragging = false;
        let captured = false;
        let longPressTimer = null;
        let floatingMiniRevealTimer = null;
        let ghostMeta = null;
        let floatingMiniVisible = false;
        let dragStartedAt = 0;
        let dragStartX = NaN;
        let dragStartY = NaN;
        const restoreStyleTargets = [];
        const restoreDraggableTargets = [];
        const rememberDraggableState = (el) => {
            if (!(el instanceof HTMLElement)) return;
            if (restoreDraggableTargets.some((entry) => entry?.el === el)) return;
            restoreDraggableTargets.push({
                el,
                value: el.getAttribute('draggable'),
            });
            try { el.setAttribute('draggable', 'false'); } catch (e) {}
        };
        const rememberTouchDragStyle = (el) => {
            if (!(el instanceof HTMLElement)) return;
            if (restoreStyleTargets.some((entry) => entry?.el === el)) return;
            restoreStyleTargets.push({
                el,
                touchAction: el.style.touchAction,
                webkitUserDrag: el.style.webkitUserDrag,
                webkitTouchCallout: el.style.webkitTouchCallout,
            });
            try { el.style.touchAction = 'none'; } catch (e) {}
            try { el.style.webkitUserDrag = 'none'; } catch (e) {}
            try { el.style.webkitTouchCallout = 'none'; } catch (e) {}
        };
        const restoreDraggableState = () => {
            restoreDraggableTargets.forEach((entry) => {
                const el = entry?.el;
                if (!(el instanceof HTMLElement)) return;
                try {
                    if (entry.value == null) el.removeAttribute('draggable');
                    else el.setAttribute('draggable', String(entry.value));
                } catch (e) {}
            });
            restoreDraggableTargets.length = 0;
        };
        const restoreTouchDragStyle = () => {
            restoreStyleTargets.forEach((entry) => {
                const el = entry?.el;
                if (!(el instanceof HTMLElement)) return;
                try { el.style.touchAction = entry.touchAction || ''; } catch (e) {}
                try { el.style.webkitUserDrag = entry.webkitUserDrag || ''; } catch (e) {}
                try { el.style.webkitTouchCallout = entry.webkitTouchCallout || ''; } catch (e) {}
            });
            restoreStyleTargets.length = 0;
        };
        const onContextMenu = (e2) => {
            try { e2?.preventDefault?.(); } catch (e) {}
            try { e2?.stopPropagation?.(); } catch (e) {}
            return false;
        };
        const onNativeDragStart = (e2) => {
            try { e2?.preventDefault?.(); } catch (e) {}
            try { e2?.stopPropagation?.(); } catch (e) {}
            return false;
        };
        const preventTouchDragScroll = (e2) => {
            if (ended || !dragging) return;
            try { e2?.preventDefault?.(); } catch (e) {}
        };
        const resolvePointTarget = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            try {
                const hit = document.elementFromPoint(x, y);
                return hit instanceof Element ? hit : null;
            } catch (e) {
                return null;
            }
        };
        const clearTaskRowHover = () => {
            try { __tmClearTaskRowDropIndicators(); } catch (e) {}
        };
        const samePointer = (e2) => {
            if (!Number.isFinite(pointerId)) return true;
            const cur = Number(e2?.pointerId);
            if (!Number.isFinite(cur)) return true;
            return cur === pointerId;
        };
        const getTouchPoint = (e2) => {
            const touch = e2?.touches?.[0] || e2?.changedTouches?.[0] || null;
            if (!touch) return null;
            const x = Number(touch?.clientX);
            const y = Number(touch?.clientY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { x, y };
        };
        const capturePointer = () => {
            if (captured || !Number.isFinite(pointerId) || typeof sourceEl.setPointerCapture !== 'function') return;
            try {
                sourceEl.setPointerCapture(pointerId);
                captured = true;
            } catch (e) {}
        };
        const cancelLongPress = () => {
            if (!longPressTimer) return;
            try { clearTimeout(longPressTimer); } catch (e) {}
            longPressTimer = null;
        };
        const cancelFloatingMiniStart = () => {
            if (!floatingMiniRevealTimer) return;
            try { clearTimeout(floatingMiniRevealTimer); } catch (e) {}
            floatingMiniRevealTimer = null;
        };
        const startFloatingMini = () => {
            cancelFloatingMiniStart();
            if (!dragging || ended || floatingMiniVisible) return false;
            try {
                floatingMiniVisible = !!__tmCalendarFloatingDragStart(id, dragMeta, {
                    clientX: lastX,
                    clientY: lastY,
                    target: resolvePointTarget(lastX, lastY) || sourceEl,
                }, { mode: 'mobile', html5: false });
            } catch (e) {
                floatingMiniVisible = false;
            }
            return floatingMiniVisible;
        };
        const cleanup = (suppressClick) => {
            if (ended) return;
            ended = true;
            cancelLongPress();
            cancelFloatingMiniStart();
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onPointerCancel, true); } catch (e) {}
            try { document.removeEventListener('touchmove', onTouchMove, true); } catch (e) {}
            try { document.removeEventListener('touchend', onTouchEnd, true); } catch (e) {}
            try { document.removeEventListener('touchcancel', onTouchEnd, true); } catch (e) {}
            try { window.removeEventListener('touchmove', preventTouchDragScroll, true); } catch (e) {}
            try { window.removeEventListener('pointermove', preventTouchDragScroll, true); } catch (e) {}
            try { document.removeEventListener('contextmenu', onContextMenu, true); } catch (e) {}
            try { sourceEl.removeEventListener('dragstart', onNativeDragStart, true); } catch (e) {}
            try { activeEl?.removeEventListener?.('dragstart', onNativeDragStart, true); } catch (e) {}
            restoreDraggableState();
            restoreTouchDragStyle();
            try { window.removeEventListener('blur', onBlur, true); } catch (e) {}
            if (captured && Number.isFinite(pointerId) && typeof sourceEl.releasePointerCapture === 'function') {
                try { sourceEl.releasePointerCapture(pointerId); } catch (e) {}
            }
            if (ghostMeta?.ghost instanceof HTMLElement) {
                try { ghostMeta.ghost.remove(); } catch (e) {}
            }
            try { __tmSetCalendarSideDockDragHidden(false); } catch (e) {}
            clearTaskRowHover();
            try { __tmCalendarFloatingDragEnd(); } catch (e) {}
            if (String(state.draggingTaskId || '').trim() === id) state.draggingTaskId = '';
            try { document.body.style.userSelect = ''; } catch (e) {}
            try { document.body.style.cursor = ''; } catch (e) {}
            if (suppressClick) {
                __tmSuppressDockPointerTaskClick(260);
            }
        };
        const startDrag = () => {
            if (dragging || ended) return;
            dragging = true;
            dragStartedAt = Date.now();
            dragStartX = lastX;
            dragStartY = lastY;
            capturePointer();
            state.draggingTaskId = id;
            try { __tmSetCalendarSideDockDragHidden(true); } catch (e) {}
            try {
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';
            } catch (e) {}
            ghostMeta = __tmBuildDockPointerTaskGhost(id, sourceEl, payload, lastX, lastY);
            if (shouldRevealFloatingMiniImmediately) {
                try { startFloatingMini(); } catch (e) {}
            }
        };
        const updateDrag = (x, y) => {
            if (!dragging) return;
            __tmPlaceDockPointerTaskGhost(ghostMeta, x, y);
            if (!floatingMiniVisible && shouldRevealFloatingMiniImmediately) {
                try { startFloatingMini(); } catch (e) {}
            } else if (!floatingMiniVisible) {
                const dx0 = Number.isFinite(dragStartX) ? (x - dragStartX) : 0;
                const dy0 = Number.isFinite(dragStartY) ? (y - dragStartY) : 0;
                const movedEnough = (dx0 * dx0 + dy0 * dy0) >= (floatingMiniRevealDistance * floatingMiniRevealDistance);
                if (movedEnough) {
                    const elapsed = Math.max(0, Date.now() - dragStartedAt);
                    if (elapsed >= floatingMiniRevealDelayMs) {
                        startFloatingMini();
                    } else if (!floatingMiniRevealTimer) {
                        floatingMiniRevealTimer = setTimeout(() => {
                            floatingMiniRevealTimer = null;
                            startFloatingMini();
                        }, Math.max(0, floatingMiniRevealDelayMs - elapsed));
                    }
                } else {
                    cancelFloatingMiniStart();
                }
            }
            try {
                const pointTarget = resolvePointTarget(x, y) || sourceEl;
                __tmCalendarFloatingDragMove({
                    clientX: x,
                    clientY: y,
                    target: pointTarget,
                }, { mode: 'mobile' });
            } catch (e) {}
            const taskRowEl = resolvePointTarget(x, y)?.closest?.('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') || null;
            if (taskRowEl instanceof HTMLElement) {
                try {
                    window.tmTaskRowDragOver?.({
                        preventDefault() {},
                        stopPropagation() {},
                        clientY: y,
                        dataTransfer: {
                            getData(type) {
                                if (String(type || '').trim() === 'application/x-tm-task-id' || String(type || '').trim() === 'text/plain') return id;
                                return '';
                            },
                        },
                        target: taskRowEl,
                        currentTarget: taskRowEl,
                    }, String(taskRowEl.getAttribute('data-id') || '').trim());
                } catch (e) {}
            } else {
                clearTaskRowHover();
            }
        };
        const finalizeDrag = async () => {
            cancelLongPress();
            cancelFloatingMiniStart();
            try {
                if (dragging) {
                    const pointTarget = resolvePointTarget(lastX, lastY) || sourceEl;
                    const handled = await globalThis.__tmCalendar?.finalizeFloatingMiniCalendarTouchDrop?.({
                        taskId: id,
                        clientX: lastX,
                        clientY: lastY,
                        target: pointTarget,
                        mode: 'mobile',
                    });
                    if (!handled) {
                        const taskRowEl = pointTarget?.closest?.('.tm-checklist-item[data-id], #tmTaskTable tbody tr[data-id]') || null;
                        if (taskRowEl instanceof HTMLElement) {
                            await window.tmTaskRowDrop?.({
                                preventDefault() {},
                                stopPropagation() {},
                                clientY: lastY,
                                dataTransfer: {
                                    getData(type) {
                                        if (String(type || '').trim() === 'application/x-tm-task-id' || String(type || '').trim() === 'text/plain') return id;
                                        return '';
                                    },
                                },
                                target: taskRowEl,
                                currentTarget: taskRowEl,
                            }, String(taskRowEl.getAttribute('data-id') || '').trim());
                        }
                    }
                }
            } finally {
                cleanup(dragging);
            }
        };
        const onMove = (e2) => {
            if (ended || !samePointer(e2)) return;
            lastX = Number(e2?.clientX) || lastX;
            lastY = Number(e2?.clientY) || lastY;
            if (!dragging) {
                const dx = lastX - startX;
                const dy = lastY - startY;
                if ((dx * dx + dy * dy) >= (longPressMoveTolerance * longPressMoveTolerance)) {
                    cleanup(false);
                }
                return;
            }
            updateDrag(lastX, lastY);
            try { e2.preventDefault(); } catch (e) {}
        };
        const onUp = async (e2) => {
            if (ended || !samePointer(e2)) return;
            lastX = Number(e2?.clientX) || lastX;
            lastY = Number(e2?.clientY) || lastY;
            try { e2.preventDefault(); } catch (e) {}
            await finalizeDrag();
        };
        const onTouchMove = (e2) => {
            if (ended) return;
            const point = getTouchPoint(e2);
            if (!point) return;
            lastX = point.x;
            lastY = point.y;
            if (!dragging) {
                const dx = lastX - startX;
                const dy = lastY - startY;
                if ((dx * dx + dy * dy) >= (longPressMoveTolerance * longPressMoveTolerance)) {
                    cleanup(false);
                }
                return;
            }
            updateDrag(lastX, lastY);
            try { e2.preventDefault(); } catch (e) {}
        };
        const onTouchEnd = async (e2) => {
            if (ended) return;
            const point = getTouchPoint(e2);
            if (point) {
                lastX = point.x;
                lastY = point.y;
            }
            try { e2.preventDefault(); } catch (e) {}
            await finalizeDrag();
        };
        const onPointerCancel = (e2) => {
            if (!__tmShouldUseCustomTouchTaskDrag()) {
                onUp(e2);
            }
        };
        const onBlur = () => {
            cleanup(false);
        };

        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            startDrag();
        }, longPressMs);

        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
        document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
        document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false });
        window.addEventListener('touchmove', preventTouchDragScroll, { capture: true, passive: false });
        window.addEventListener('pointermove', preventTouchDragScroll, { capture: true, passive: false });
        document.addEventListener('contextmenu', onContextMenu, true);
        rememberDraggableState(sourceEl);
        rememberDraggableState(activeEl);
        rememberTouchDragStyle(sourceEl);
        rememberTouchDragStyle(activeEl);
        sourceEl.addEventListener('dragstart', onNativeDragStart, true);
        try { activeEl?.addEventListener?.('dragstart', onNativeDragStart, true); } catch (e) {}
        window.addEventListener('blur', onBlur, true);
        return true;
    }

    window.tmTaskTouchDragStart = function(ev, taskId) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { __tmStartTouchTaskDrag(ev, taskId); } catch (e) {}
    };

    window.tmChecklistTitleClick = function(taskId, ev) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (__tmIsMultiSelectActive('checklist')) {
            window.tmChecklistSelectTask(id, ev);
            return;
        }
        const policy = globalThis.__tmViewPolicy?.getChecklistTitleClickPolicy?.() || null;
        const mode = String(policy?.mode || '').trim();
        if (mode === 'open-detail-drawer') {
            window.tmChecklistSelectTask(id, ev);
            return;
        }
        if (mode === 'open-detail-page') {
            window.tmOpenTaskDetail?.(id, ev);
            return;
        }
        if (mode === 'select') {
            window.tmChecklistSelectTask(id, ev);
            return;
        }
        if (mode === 'jump-task') {
            window.tmJumpToTask(id, ev);
            return;
        }
        if (__tmChecklistTitleClickUsesScopedJumpSettings()) {
            if (__tmShouldOpenChecklistDetailDrawerOnTitleClick()) {
                window.tmChecklistSelectTask(id, ev);
                return;
            }
            if (__tmShouldOpenTaskDetailPageOnChecklistTitleClick()) {
                window.tmOpenTaskDetail?.(id, ev);
                return;
            }
            if (__tmShouldJumpOnDockChecklistTitleClick() || __tmShouldJumpOnMobileChecklistTitleClick()) {
                window.tmJumpToTask(id, ev);
                return;
            }
            window.tmChecklistSelectTask(id, ev);
            return;
        }
        window.tmJumpToTask(id, ev);
    };

    window.tmWhiteboardStreamTaskTitleClick = function(taskId, ev) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        if (__tmIsMultiSelectActive('whiteboard')) {
            __tmToggleTaskMultiSelection(id);
            return true;
        }
        if (__tmShouldOpenTaskDetailPageOnAnyTitleClick(ev)) {
            window.tmOpenTaskDetail?.(id, ev);
            return true;
        }
        if (__tmIsMobileDevice() || __tmHostUsesMobileUI()) {
            state.detailTaskId = id;
            state.checklistDetailDismissed = false;
            state.checklistDetailSheetOpen = true;
            if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'whiteboard-title-click')) render();
            return true;
        }
        return window.tmJumpToTask(id, ev);
    };

    window.tmWhiteboardStreamTaskTitlePointerDown = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardStreamTaskTitleMouseDown = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardStreamTaskTitleTouchStart = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardStreamTaskHeadClick = function(taskId, ev) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        const target = ev?.target;
        if (target?.closest?.('button,input,select,textarea,a,.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle')) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        if (__tmIsMultiSelectActive('whiteboard')) {
            __tmToggleTaskMultiSelection(id);
            return true;
        }
        if (__tmIsMobileDevice() || __tmHostUsesMobileUI()) {
            state.detailTaskId = id;
            state.checklistDetailDismissed = false;
            state.checklistDetailSheetOpen = true;
            if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'whiteboard-head-click')) render();
            return true;
        }
        return window.tmJumpToTask(id, ev);
    };

    window.tmChecklistCloseSheet = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        try {
            const detailPanel = state.modal?.querySelector?.('#tmChecklistSheetPanel, #tmChecklistDetailPanel');
            if (detailPanel instanceof HTMLElement) {
                await detailPanel.__tmTaskDetailFlushSave?.({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: false,
                    skipRerender: true,
                });
            }
        } catch (e) {}
        state.checklistDetailDismissed = true;
        state.checklistDetailSheetOpen = false;
        __tmRefreshChecklistSelectionInPlace(state.modal, 'checklist-close-sheet');
    };

    let __tmChecklistSheetLastTouchStartAt = 0;

    function __tmGetClientYFromPointerOrTouchEvent(ev) {
        const directY = Number(ev?.clientY);
        if (Number.isFinite(directY)) return directY;
        const touch = ev?.touches?.[0] || ev?.changedTouches?.[0] || null;
        const touchY = Number(touch?.clientY);
        return Number.isFinite(touchY) ? touchY : 0;
    }

    function __tmStartChecklistSheetDrag(ev, source = 'pointer') {
        if (!__tmChecklistUseSheetMode(state.modal)) return;
        if (!state.checklistDetailSheetOpen) return;
        const sheet = state.modal?.querySelector?.('#tmChecklistSheet');
        const body = state.modal?.querySelector?.('#tmChecklistSheetPanel');
        if (!(sheet instanceof HTMLElement)) return;
        const target = ev?.target;
        if (!(target instanceof Element)) return;
        if (target.closest('input, textarea, select, button, a, label')) return;
        const fromHandle = !!target.closest('.tm-checklist-sheet-handle');
        const inBody = !!target.closest('.tm-checklist-sheet-body');
        const bodyScrollTop = Number(body?.scrollTop || 0);
        const pointerY = __tmGetClientYFromPointerOrTouchEvent(ev);
        if (__tmIsMobileDevice() && !fromHandle) return;
        if (!fromHandle && inBody && bodyScrollTop > 0) return;
        try { ev.preventDefault?.(); } catch (e) {}
        const startY = pointerY;
        let lastY = startY;
        let lastTs = Date.now();
        let velocity = 0;
        sheet.classList.add('tm-checklist-sheet--dragging');
        const onMove = (e2) => {
            const y = __tmGetClientYFromPointerOrTouchEvent(e2);
            let dy = y - startY;
            if (!Number.isFinite(dy)) dy = 0;
            if (dy < 0) dy = dy * 0.18;
            sheet.style.transform = `translateY(${Math.max(-24, dy)}px)`;
            const now = Date.now();
            const dt = Math.max(1, now - lastTs);
            velocity = (y - lastY) / dt;
            lastY = y;
            lastTs = now;
            try { e2.preventDefault?.(); } catch (e) {}
        };
        const onUp = (e2) => {
            if (source === 'touch') {
                try { window.removeEventListener('touchmove', onMove, true); } catch (e) {}
                try { window.removeEventListener('touchend', onUp, true); } catch (e) {}
                try { window.removeEventListener('touchcancel', onUp, true); } catch (e) {}
            } else {
                try { window.removeEventListener('pointermove', onMove, true); } catch (e) {}
                try { window.removeEventListener('pointerup', onUp, true); } catch (e) {}
                try { window.removeEventListener('pointercancel', onUp, true); } catch (e) {}
                try { sheet.releasePointerCapture?.(ev?.pointerId); } catch (e) {}
            }
            const endY = __tmGetClientYFromPointerOrTouchEvent(e2) || lastY || startY;
            const dy = Math.max(0, endY - startY);
            sheet.classList.remove('tm-checklist-sheet--dragging');
            sheet.style.transform = '';
            const closeByDistance = dy >= 88;
            const closeByVelocity = velocity > 0.55 && dy > 18;
            if (closeByDistance || closeByVelocity) {
                window.tmChecklistCloseSheet(e2);
                return;
            }
            __tmRefreshChecklistSelectionInPlace(state.modal, 'checklist-sheet-drag-end');
        };
        if (source === 'touch') {
            try { window.addEventListener('touchmove', onMove, { capture: true, passive: false }); } catch (e) {}
            try { window.addEventListener('touchend', onUp, true); } catch (e) {}
            try { window.addEventListener('touchcancel', onUp, true); } catch (e) {}
        } else {
            try { sheet.setPointerCapture?.(ev.pointerId); } catch (e) {}
            try { window.addEventListener('pointermove', onMove, true); } catch (e) {}
            try { window.addEventListener('pointerup', onUp, true); } catch (e) {}
            try { window.addEventListener('pointercancel', onUp, true); } catch (e) {}
        }
    }

    window.tmChecklistSheetDragStart = function(ev) {
        if ((Date.now() - __tmChecklistSheetLastTouchStartAt) < 700) return;
        __tmStartChecklistSheetDrag(ev, 'pointer');
    };

    window.tmStartChecklistDetailResize = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        if (__tmChecklistUseSheetMode(state.modal)) return;
        const aside = state.modal?.querySelector?.('.tm-checklist-side');
        if (!(aside instanceof HTMLElement)) return;
        const startX = Number(ev?.clientX) || 0;
        const startW = Math.max(260, Math.min(520, Math.round(aside.getBoundingClientRect().width || Number(SettingsStore.data.checklistDetailWidth) || 320)));
        const onMove = (e2) => {
            const x = Number(e2?.clientX) || 0;
            const delta = startX - x;
            const nextW = Math.max(260, Math.min(520, Math.round(startW + delta)));
            aside.style.width = `${nextW}px`;
            aside.style.minWidth = `${nextW}px`;
            aside.style.flexBasis = `${nextW}px`;
            SettingsStore.data.checklistDetailWidth = nextW;
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e2) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e2) {}
            try { await SettingsStore.save(); } catch (e2) {}
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e2) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e2) {}
    };

    window.tmToggleDocTabs = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        state.docTabsHidden = !state.docTabsHidden;
        try { Storage.set('tm_doc_tabs_hidden', !!state.docTabsHidden); } catch (e) {}
        const el = state.modal?.querySelector?.('.tm-doc-tabs');
        if (el) {
            try {
                if (state.docTabsHidden) el.classList.add('tm-doc-tabs--hidden');
                else el.classList.remove('tm-doc-tabs--hidden');
            } catch (e) {}
            return;
        }
        render();
    };

    function __tmNormalizeLucideIconName(iconName) {
        return String(iconName || '').trim().toLowerCase();
    }

    const __tmPhosphorBoldPaths = {
        'alarm-clock': 'M128,36A100,100,0,1,0,228,136,100.11,100.11,0,0,0,128,36Zm0,176a76,76,0,1,1,76-76A76.08,76.08,0,0,1,128,212ZM32.49,72.49a12,12,0,1,1-17-17l32-32a12,12,0,1,1,17,17Zm208,0a12,12,0,0,1-17,0l-32-32a12,12,0,1,1,17-17l32,32A12,12,0,0,1,240.49,72.49ZM176,124a12,12,0,0,1,0,24H128a12,12,0,0,1-12-12V88a12,12,0,0,1,24,0v36Z',
        'arrow-clockwise': 'M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z',
        repeat: 'M20,128A76.08,76.08,0,0,1,96,52h99l-3.52-3.51a12,12,0,1,1,17-17l24,24a12,12,0,0,1,0,17l-24,24a12,12,0,0,1-17-17L195,76H96a52.06,52.06,0,0,0-52,52,12,12,0,0,1-24,0Zm204-12a12,12,0,0,0-12,12,52.06,52.06,0,0,1-52,52H61l3.52-3.51a12,12,0,1,0-17-17l-24,24a12,12,0,0,0,0,17l24,24a12,12,0,1,0,17-17L61,204h99a76.08,76.08,0,0,0,76-76A12,12,0,0,0,224,116Z',
        'arrows-clockwise': 'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z',
        'bot': 'M72,104a16,16,0,1,1,16,16A16,16,0,0,1,72,104Zm96,16a16,16,0,1,0-16-16A16,16,0,0,0,168,120Zm68-40V192a36,36,0,0,1-36,36H56a36,36,0,0,1-36-36V80A36,36,0,0,1,56,44h60V16a12,12,0,0,1,24,0V44h60A36,36,0,0,1,236,80Zm-24,0a12,12,0,0,0-12-12H56A12,12,0,0,0,44,80V192a12,12,0,0,0,12,12H200a12,12,0,0,0,12-12Zm-12,82a30,30,0,0,1-30,30H86a30,30,0,0,1,0-60h84A30,30,0,0,1,200,162Zm-80-6v12h16V156ZM86,168H96V156H86a6,6,0,0,0,0,12Zm90-6a6,6,0,0,0-6-6H160v12h10A6,6,0,0,0,176,162Z',
        'calendar-check': 'M208,28H188V20a12,12,0,0,0-24,0v8H92V20a12,12,0,0,0-24,0v8H48A20.02229,20.02229,0,0,0,28,48V208a20.02229,20.02229,0,0,0,20,20H208a20.02229,20.02229,0,0,0,20-20V48A20.02229,20.02229,0,0,0,208,28Zm-4,24V76H52V52ZM52,204V100H204V204Zm120.72559-84.2373a12.00022,12.00022,0,0,1-.499,16.96386l-46.6665,44a11.99953,11.99953,0,0,1-16.48486-.02051l-25.3335-24a11.99964,11.99964,0,1,1,16.50586-17.42187l17.1001,16.19922,38.415-36.21973A11.99993,11.99993,0,0,1,172.72559,119.7627Z',
        'calendar-clock': 'M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Z',
        'calendar-days': 'M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Z',
        'calendar-plus-2': 'M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm112-52a12,12,0,0,1-12,12H140v12a12,12,0,0,1-24,0V164H104a12,12,0,0,1,0-24h12V128a12,12,0,0,1,24,0v12h12A12,12,0,0,1,164,152Z',
        'chart-column': 'M224,196h-4V40a12,12,0,0,0-12-12H152a12,12,0,0,0-12,12V76H96A12,12,0,0,0,84,88v36H48a12,12,0,0,0-12,12v60H32a12,12,0,0,0,0,24H224a12,12,0,0,0,0-24ZM164,52h32V196H164Zm-56,48h32v96H108ZM60,148H84v48H60Z',
        'check-circle-2': 'M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z',
        'chevron-left': 'M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z',
        'chevron-right': 'M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z',
        'dots-three': 'M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm136,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112Z',
        'file-text': 'M216.49,79.52l-56-56A12,12,0,0,0,152,20H56A20,20,0,0,0,36,40V216a20,20,0,0,0,20,20H200a20,20,0,0,0,20-20V88A12,12,0,0,0,216.49,79.52ZM160,57l23,23H160ZM60,212V44h76V92a12,12,0,0,0,12,12h48V212Zm112-80a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,132Zm0,40a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,172Z',
        'flag': 'M40.14,46.88A12,12,0,0,0,36,56V224a12,12,0,0,0,24,0V181.72c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2,14.72,0,30.28-4.94,46.38-18.88A12,12,0,0,0,236,176V56a12,12,0,0,0-19.86-9.07c-24.71,21.41-44.53,13.31-74.82-1.68C113.19,31.27,78.17,13.94,40.14,46.88ZM212,170.26c-22.84,17.13-42.1,9.11-70.68-5C118.16,153.76,90.33,140,60,153.87V61.69c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2A63,63,0,0,0,212,78.08Z',
        'map': 'M231.38,46.54a12,12,0,0,0-10.29-2.18L161.4,59.28l-60-30a12,12,0,0,0-8.28-.91l-64,16A12,12,0,0,0,20,56V200a12,12,0,0,0,14.91,11.64L94.6,196.72l60,30a12,12,0,0,0,8.28.91l64-16A12,12,0,0,0,236,200V56A12,12,0,0,0,231.38,46.54ZM108,59.42l40,20V196.58l-40-20Zm-64,6,40-10V174.63l-40,10ZM212,190.63l-40,10V81.37l40-10Z',
        'map-pin': 'M128,60a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,60Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,124Zm0-112a92.1,92.1,0,0,0-92,92c0,77.36,81.64,135.4,85.12,137.83a12,12,0,0,0,13.76,0,259,259,0,0,0,42.18-39C205.15,170.57,220,136.37,220,104A92.1,92.1,0,0,0,128,12Zm31.3,174.71A249.35,249.35,0,0,1,128,216.89a249.35,249.35,0,0,1-31.3-30.18C80,167.37,60,137.31,60,104a68,68,0,0,1,136,0C196,137.31,176,167.37,159.3,186.71Z',
        'menu': 'M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM40,76H216a12,12,0,0,0,0-24H40a12,12,0,0,0,0,24ZM216,180H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Z',
        'minus': 'M216,140H40a12,12,0,0,1,0-24H216a12,12,0,0,1,0,24Z',
        'pin': 'M216,164h-5.93L190.3,52H192a12,12,0,0,0,0-24H64a12,12,0,0,0,0,24h1.7L45.93,164H40a12,12,0,0,0,0,24h76v52a12,12,0,0,0,24,0V188h76a12,12,0,0,0,0-24ZM90.07,52h75.86L185.7,164H70.3Z',
        'plus': 'M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z',
        'puzzle': 'M222.41,155.16a12,12,0,0,0-11.56-.69A16,16,0,0,1,188,139,16.2,16.2,0,0,1,202.8,124a15.83,15.83,0,0,1,8,1.5A12,12,0,0,0,228,114.7V72a20,20,0,0,0-20-20H176a40.15,40.15,0,0,0-12.62-29.16,39.67,39.67,0,0,0-29.94-10.76,40.08,40.08,0,0,0-37.34,37C96,50.07,96,51,96,52H64A20,20,0,0,0,44,72v28a40.15,40.15,0,0,0-29.16,12.62A40,40,0,0,0,41.1,179.9a28.3,28.3,0,0,0,2.9.1v28a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V165.31A12,12,0,0,0,222.41,155.16ZM204,204H68V165.31a12,12,0,0,0-17.15-10.84A15.9,15.9,0,0,1,42.8,156,16.2,16.2,0,0,1,28,141.06a16,16,0,0,1,22.82-15.52A12,12,0,0,0,68,114.7V76h42.7a12,12,0,0,0,10.83-17.15A15.9,15.9,0,0,1,120,50.8,16.19,16.19,0,0,1,134.94,36a16,16,0,0,1,15.53,22.81A12,12,0,0,0,161.31,76H204v24c-1,0-1.93,0-2.9.11A40,40,0,0,0,204,180h0Z',
        'save': 'M222.14,69.17,186.83,33.86A19.86,19.86,0,0,0,172.69,28H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V83.31A19.86,19.86,0,0,0,222.14,69.17ZM164,204H92V160h72Zm40,0H188V156a20,20,0,0,0-20-20H88a20,20,0,0,0-20,20v48H52V52H171l33,33ZM164,84a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h56A12,12,0,0,1,164,84Z',
        'search': 'M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z',
        'settings': 'M128,76a52,52,0,1,0,52,52A52.06,52.06,0,0,0,128,76Zm0,80a28,28,0,1,1,28-28A28,28,0,0,1,128,156Zm92-27.21v-1.58l14-17.51a12,12,0,0,0,2.23-10.59A111.75,111.75,0,0,0,225,71.89,12,12,0,0,0,215.89,66L193.61,63.5l-1.11-1.11L190,40.1A12,12,0,0,0,184.11,31a111.67,111.67,0,0,0-27.23-11.27A12,12,0,0,0,146.3,22L128.79,36h-1.58L109.7,22a12,12,0,0,0-10.59-2.23A111.75,111.75,0,0,0,71.89,31.05,12,12,0,0,0,66,40.11L63.5,62.39,62.39,63.5,40.1,66A12,12,0,0,0,31,71.89,111.67,111.67,0,0,0,19.77,99.12,12,12,0,0,0,22,109.7l14,17.51v1.58L22,146.3a12,12,0,0,0-2.23,10.59,111.75,111.75,0,0,0,11.29,27.22A12,12,0,0,0,40.11,190l22.28,2.48,1.11,1.11L66,215.9A12,12,0,0,0,71.89,225a111.67,111.67,0,0,0,27.23,11.27A12,12,0,0,0,109.7,234l17.51-14h1.58l17.51,14a12,12,0,0,0,10.59,2.23A111.75,111.75,0,0,0,184.11,225a12,12,0,0,0,5.91-9.06l2.48-22.28,1.11-1.11L215.9,190a12,12,0,0,0,9.06-5.91,111.67,111.67,0,0,0,11.27-27.23A12,12,0,0,0,234,146.3Zm-24.12-4.89a70.1,70.1,0,0,1,0,8.2,12,12,0,0,0,2.61,8.22l12.84,16.05A86.47,86.47,0,0,1,207,166.86l-20.43,2.27a12,12,0,0,0-7.65,4,69,69,0,0,1-5.8,5.8,12,12,0,0,0-4,7.65L166.86,207a86.47,86.47,0,0,1-10.49,4.35l-16.05-12.85a12,12,0,0,0-7.5-2.62c-.24,0-.48,0-.72,0a70.1,70.1,0,0,1-8.2,0,12.06,12.06,0,0,0-8.22,2.6L99.63,211.33A86.47,86.47,0,0,1,89.14,207l-2.27-20.43a12,12,0,0,0-4-7.65,69,69,0,0,1-5.8-5.8,12,12,0,0,0-7.65-4L49,166.86a86.47,86.47,0,0,1-4.35-10.49l12.84-16.05a12,12,0,0,0,2.61-8.22,70.1,70.1,0,0,1,0-8.2,12,12,0,0,0-2.61-8.22L44.67,99.63A86.47,86.47,0,0,1,49,89.14l20.43-2.27a12,12,0,0,0,7.65-4,69,69,0,0,1,5.8-5.8,12,12,0,0,0,4-7.65L89.14,49a86.47,86.47,0,0,1,10.49-4.35l16.05,12.85a12.06,12.06,0,0,0,8.22,2.6,70.1,70.1,0,0,1,8.2,0,12,12,0,0,0,8.22-2.6l16.05-12.85A86.47,86.47,0,0,1,166.86,49l2.27,20.43a12,12,0,0,0,4,7.65,69,69,0,0,1,5.8,5.8,12,12,0,0,0,7.65,4L207,89.14a86.47,86.47,0,0,1,4.35,10.49l-12.84,16.05A12,12,0,0,0,195.88,123.9Z',
        'clock-countdown': 'M232,136.66A104.12,104.12,0,1,1,119.34,24,8,8,0,0,1,120.66,40,88.12,88.12,0,1,0,216,135.34,8,8,0,0,1,232,136.66ZM120,72v56a8,8,0,0,0,8,8h56a8,8,0,0,0,0-16H136V72a8,8,0,0,0-16,0Zm40-24a12,12,0,1,0-12-12A12,12,0,0,0,160,48Zm36,24a12,12,0,1,0-12-12A12,12,0,0,0,196,72Zm24,36a12,12,0,1,0-12-12A12,12,0,0,0,220,108Z',
        'timer': 'M128,44a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,44Zm0,168a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,212ZM164.49,99.51a12,12,0,0,1,0,17l-28,28a12,12,0,0,1-17-17l28-28A12,12,0,0,1,164.49,99.51ZM92,16A12,12,0,0,1,104,4h48a12,12,0,0,1,0,24H104A12,12,0,0,1,92,16Z',
        'x': 'M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z',
    };

    __tmPhosphorBoldPaths['link-simple'] = 'M87.5,151.52l64-64a12,12,0,0,1,17,17l-64,64a12,12,0,0,1-17-17Zm131-114a60.08,60.08,0,0,0-84.87,0L103.51,67.61a12,12,0,0,0,17,17l30.07-30.06a36,36,0,0,1,50.93,50.92L171.4,135.52a12,12,0,1,0,17,17l30.08-30.06A60.09,60.09,0,0,0,218.45,37.55ZM135.52,171.4l-30.07,30.08a36,36,0,0,1-50.92-50.93l30.06-30.07a12,12,0,0,0-17-17L37.55,133.58a60,60,0,0,0,84.88,84.87l30.06-30.07a12,12,0,0,0-17-17Z';
    __tmPhosphorBoldPaths['arrow-up'] = 'M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z';
    __tmPhosphorBoldPaths['arrow-down'] = 'M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z';
    __tmPhosphorBoldPaths['list-bullets'] = 'M76,64A12,12,0,0,1,88,52H216a12,12,0,0,1,0,24H88A12,12,0,0,1,76,64Zm140,52H88a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Zm0,64H88a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM44,112a16,16,0,1,0,16,16A16,16,0,0,0,44,112Zm0-64A16,16,0,1,0,60,64,16,16,0,0,0,44,48Zm0,128a16,16,0,1,0,16,16A16,16,0,0,0,44,176Z';
    __tmPhosphorBoldPaths['list-numbers'] = 'M228,128a12,12,0,0,1-12,12H116a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM116,76H216a12,12,0,0,0,0-24H116a12,12,0,0,0,0,24ZM216,180H116a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM44,59.31V104a12,12,0,0,0,24,0V40A12,12,0,0,0,50.64,29.27l-16,8a12,12,0,0,0,9.36,22Zm39.73,96.86a27.7,27.7,0,0,0-11.2-18.63A28.89,28.89,0,0,0,32.9,143a27.71,27.71,0,0,0-4.17,7.54,12,12,0,0,0,22.55,8.21,4,4,0,0,1,.58-1,4.78,4.78,0,0,1,6.5-.82,3.82,3.82,0,0,1,1.61,2.6,3.63,3.63,0,0,1-.77,2.77l-.13.17L30.39,200.82A12,12,0,0,0,40,220H72a12,12,0,0,0,0-24H64l14.28-19.11A27.48,27.48,0,0,0,83.73,156.17Z';
    __tmPhosphorBoldPaths['paperclip'] = 'M212.48,136.49l-82.06,82a60,60,0,0,1-84.85-84.88l98.16-97.89a40,40,0,0,1,56.56,56.59l-.17.16-95.8,92.22a12,12,0,1,1-16.64-17.3l95.71-92.12a16,16,0,0,0-22.7-22.56L62.53,150.57a36,36,0,0,0,50.93,50.91l82.06-82a12,12,0,0,1,17,17Z';
    __tmPhosphorBoldPaths['text-indent'] = 'M228,128a12,12,0,0,1-12,12H120a12,12,0,0,1,0-24h96A12,12,0,0,1,228,128ZM120,76h96a12,12,0,0,0,0-24H120a12,12,0,0,0,0,24Zm96,104H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM31.51,144.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0,0-17l-40-40a12,12,0,0,0-17,17L63,96,31.51,127.51A12,12,0,0,0,31.51,144.49Z';
    __tmPhosphorBoldPaths['text-outdent'] = 'M228,128a12,12,0,0,1-12,12H120a12,12,0,0,1,0-24h96A12,12,0,0,1,228,128ZM120,76h96a12,12,0,0,0,0-24H120a12,12,0,0,0,0,24Zm96,104H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM72,148a12,12,0,0,0,8.49-20.49L49,96,80.49,64.48a12,12,0,0,0-17-17l-40,40a12,12,0,0,0,0,17l40,40A12,12,0,0,0,72,148Z';
    __tmPhosphorBoldPaths['hand'] = 'M188,44a32,32,0,0,0-8,1V44a32,32,0,0,0-60.79-14A32,32,0,0,0,76,60v50.83a32,32,0,0,0-52,36.7C55.82,214.6,75.35,244,128,244a92.1,92.1,0,0,0,92-92V76A32,32,0,0,0,188,44Zm8,108a68.08,68.08,0,0,1-68,68c-35.83,0-49.71-14-82.48-83.14-.14-.29-.29-.58-.45-.86a8,8,0,0,1,13.85-8l.21.35,18.68,30A12,12,0,0,0,100,152V60a8,8,0,0,1,16,0v60a12,12,0,0,0,24,0V44a8,8,0,0,1,16,0v76a12,12,0,0,0,24,0V76a8,8,0,0,1,16,0Z';
    __tmPhosphorBoldPaths['selection-plus'] = 'M156,40a12,12,0,0,1-12,12H112a12,12,0,0,1,0-24h32A12,12,0,0,1,156,40ZM144,204H112a12,12,0,0,0,0,24h32a12,12,0,0,0,0-24ZM204,52V72a12,12,0,0,0,24,0V48a20,20,0,0,0-20-20H184a12,12,0,0,0,0,24Zm12,48a12,12,0,0,0-12,12v32a12,12,0,0,0,24,0V112A12,12,0,0,0,216,100ZM40,156a12,12,0,0,0,12-12V112a12,12,0,0,0-24,0v32A12,12,0,0,0,40,156Zm32,48H52V184a12,12,0,0,0-24,0v24a20,20,0,0,0,20,20H72a12,12,0,0,0,0-24ZM72,28H48A20,20,0,0,0,28,48V72a12,12,0,0,0,24,0V52H72a12,12,0,0,0,0-24ZM240,204H228V192a12,12,0,0,0-24,0v12H192a12,12,0,0,0,0,24h12v12a12,12,0,0,0,24,0V228h12a12,12,0,0,0,0-24Z';
    __tmPhosphorBoldPaths['cursor-text'] = 'M188,208a12,12,0,0,1-12,12H160a43.86,43.86,0,0,1-32-13.85A43.86,43.86,0,0,1,96,220H80a12,12,0,0,1,0-24H96a20,20,0,0,0,20-20V140H104a12,12,0,0,1,0-24h12V80A20,20,0,0,0,96,60H80a12,12,0,0,1,0-24H96a43.86,43.86,0,0,1,32,13.85A43.86,43.86,0,0,1,160,36h16a12,12,0,0,1,0,24H160a20,20,0,0,0-20,20v36h12a12,12,0,0,1,0,24H140v36a20,20,0,0,0,20,20h16A12,12,0,0,1,188,208Z';
    __tmPhosphorBoldPaths['note-pencil'] = 'M232.49,55.51l-32-32a12,12,0,0,0-17,0l-96,96A12,12,0,0,0,84,128v32a12,12,0,0,0,12,12h32a12,12,0,0,0,8.49-3.51l96-96A12,12,0,0,0,232.49,55.51ZM192,49l15,15L196,75,181,60Zm-69,99H108V133l56-56,15,15Zm105-7.43V208a20,20,0,0,1-20,20H48a20,20,0,0,1-20-20V48A20,20,0,0,1,48,28h67.43a12,12,0,0,1,0,24H52V204H204V140.57a12,12,0,0,1,24,0Z';
    __tmPhosphorBoldPaths['link-simple-break'] = 'M218.45,122.43l-30.08,30.06a12,12,0,0,1-17-17l30.08-30.07a36,36,0,0,0-50.93-50.92L120.48,84.59a12,12,0,0,1-17-17l30.07-30.06a60,60,0,0,1,84.87,84.88Zm-82.93,49-30.07,30.08a36,36,0,0,1-50.92-50.93l30.06-30.07a12,12,0,0,0-17-17L37.55,133.58a60,60,0,0,0,84.88,84.87l30.06-30.07a12,12,0,0,0-17-17Z';
    __tmPhosphorBoldPaths['corners-in'] = 'M148,96V48a12,12,0,0,1,24,0V84h36a12,12,0,0,1,0,24H160A12,12,0,0,1,148,96ZM96,148H48a12,12,0,0,0,0,24H84v36a12,12,0,0,0,24,0V160A12,12,0,0,0,96,148Zm112,0H160a12,12,0,0,0-12,12v48a12,12,0,0,0,24,0V172h36a12,12,0,0,0,0-24ZM96,36A12,12,0,0,0,84,48V84H48a12,12,0,0,0,0,24H96a12,12,0,0,0,12-12V48A12,12,0,0,0,96,36Z';
    __tmPhosphorBoldPaths['text-h'] = 'M212,56V200a12,12,0,0,1-24,0V140H68v60a12,12,0,0,1-24,0V56a12,12,0,0,1,24,0v60H188V56a12,12,0,0,1,24,0Z';
    __tmPhosphorBoldPaths['text-h-one'] = 'M236,112v96a12,12,0,0,1-24,0V134.42L206.66,138a12,12,0,0,1-13.32-20l24-16A12,12,0,0,1,236,112ZM144,44a12,12,0,0,0-12,12v48H52V56a12,12,0,0,0-24,0V176a12,12,0,0,0,24,0V128h80v48a12,12,0,0,0,24,0V56A12,12,0,0,0,144,44Z';
    __tmPhosphorBoldPaths['text-h-two'] = 'M156,56V176a12,12,0,0,1-24,0V128H52v48a12,12,0,0,1-24,0V56a12,12,0,0,1,24,0v48h80V56a12,12,0,0,1,24,0Zm84,140H216l28.74-38.33A36,36,0,1,0,182.05,124a12,12,0,0,0,22.63,8,11.67,11.67,0,0,1,1.73-3.22,12,12,0,1,1,19.15,14.46L182.4,200.8A12,12,0,0,0,192,220h48a12,12,0,0,0,0-24Z';
    __tmPhosphorBoldPaths['text-h-three'] = 'M252,180a40,40,0,0,1-68.57,28,12,12,0,1,1,17.14-16.79A16,16,0,1,0,212,164a12,12,0,0,1-9.83-18.88L217,124H192a12,12,0,0,1,0-24h48a12,12,0,0,1,9.83,18.88l-18.34,26.2A40,40,0,0,1,252,180ZM144,44a12,12,0,0,0-12,12v48H52V56a12,12,0,0,0-24,0V176a12,12,0,0,0,24,0V128h80v48a12,12,0,0,0,24,0V56A12,12,0,0,0,144,44Z';
    __tmPhosphorBoldPaths['text-h-four'] = 'M156,56V176a12,12,0,0,1-24,0V128H52v48a12,12,0,0,1-24,0V56a12,12,0,0,1,24,0v48h80V56a12,12,0,0,1,24,0ZM256,184a12,12,0,0,1-12,12v12a12,12,0,0,1-24,0V196H180a12,12,0,0,1-9.73-19l52-72A12,12,0,0,1,244,112v60A12,12,0,0,1,256,184Zm-36-34.89L203.47,172H220Z';
    __tmPhosphorBoldPaths['text-h-five'] = 'M252,180a40,40,0,0,1-40,40,39.53,39.53,0,0,1-28.57-11.6,12,12,0,1,1,17.14-16.8A15.54,15.54,0,0,0,212,196a16,16,0,0,0,0-32,15.54,15.54,0,0,0-11.43,4.4A12,12,0,0,1,180.16,158l8-48A12,12,0,0,1,200,100h40a12,12,0,0,1,0,24H210.17l-2.71,16.23A45.39,45.39,0,0,1,212,140,40,40,0,0,1,252,180ZM144,44a12,12,0,0,0-12,12v48H52V56a12,12,0,0,0-24,0V176a12,12,0,0,0,24,0V128h80v48a12,12,0,0,0,24,0V56A12,12,0,0,0,144,44Z';
    __tmPhosphorBoldPaths['text-h-six'] = 'M217.06,140.33l13.24-22.18a12,12,0,1,0-20.6-12.3l-32.25,54c-.09.15-.17.31-.25.47a40,40,0,1,0,39.86-20ZM212,196a16,16,0,1,1,16-16A16,16,0,0,1,212,196ZM156,56V176a12,12,0,0,1-24,0V128H52v48a12,12,0,0,1-24,0V56a12,12,0,0,1,24,0v48h80V56a12,12,0,0,1,24,0Z';

    function __tmLucideIconSvg(iconName, options = {}) {
        const normalizedName = __tmNormalizeLucideIconName(iconName);
        const size = Math.max(1, Number(options?.size) || 14);
        const className = String(options?.className || 'tm-lucide-emoji__svg').trim();
        const style = String(options?.style || '').trim();
        const styleAttr = style ? ` style="${__tmEscAttr(style)}"` : '';
        const phosphorPath = __tmPhosphorBoldPaths[normalizedName];
        if (phosphorPath) {
            return `<svg class="${__tmEscAttr(className)}" viewBox="0 0 256 256" width="${size}" height="${size}" aria-hidden="true"${styleAttr}><path fill="currentColor" stroke="none" d="${phosphorPath}"></path></svg>`;
        }
        const body = (() => {
            switch (normalizedName) {
                case 'clipboard-list': return '<path d="M9.5 4h5" /><path d="M9 2.75h6a1.75 1.75 0 0 1 1.75 1.75v1.25h1A2.75 2.75 0 0 1 20.5 8.5v10.75A2.75 2.75 0 0 1 17.75 22H6.25A2.75 2.75 0 0 1 3.5 19.25V8.5A2.75 2.75 0 0 1 6.25 5.75h1V4.5A1.75 1.75 0 0 1 9 2.75Z" /><path d="M9 10h6" /><path d="M9 14h6" /><path d="M9 18h3.5" />';
                case 'calendar-days': return '<path d="M7.5 3.5v3" /><path d="M16.5 3.5v3" /><path d="M4.75 6.5h14.5A2.75 2.75 0 0 1 22 9.25v9.5A2.75 2.75 0 0 1 19.25 21.5H4.75A2.75 2.75 0 0 1 2 18.75v-9.5A2.75 2.75 0 0 1 4.75 6.5Z" /><path d="M2 10h20" /><path d="M7.5 14h.01" /><path d="M12 14h.01" /><path d="M16.5 14h.01" /><path d="M7.5 18h.01" /><path d="M12 18h.01" /><path d="M16.5 18h.01" />';
                case 'calendar-plus-2': return '<path d="M7.5 3.5v3" /><path d="M16.5 3.5v3" /><path d="M4.75 6.5h14.5A2.75 2.75 0 0 1 22 9.25v9.5A2.75 2.75 0 0 1 19.25 21.5H4.75A2.75 2.75 0 0 1 2 18.75v-9.5A2.75 2.75 0 0 1 4.75 6.5Z" /><path d="M2 10h20" /><path d="M12 13.5v5" /><path d="M9.5 16h5" />';
                case 'calendar-clock': return '<path d="M7.5 3.5v3" /><path d="M16.5 3.5v3" /><path d="M4.75 6.5h14.5A2.75 2.75 0 0 1 22 9.25v4.25" /><path d="M2 10h9" /><path d="M13.5 13.5A5.5 5.5 0 1 0 19 19a5.5 5.5 0 0 0-5.5-5.5Z" /><path d="M13.5 16.25V19l1.9 1.15" /><path d="M2 18.75v-9.5A2.75 2.75 0 0 1 4.75 6.5" />';
                case 'refresh-cw':
                case 'arrow-clockwise': return '<path d="M20 12A8 8 0 1 1 16.55 5.95" /><path d="M20 4v6h-6" />';
                case 'chevron-left': return '<path d="m14.5 5-7 7 7 7" />';
                case 'chevron-right':
                case 'caret-right': return '<path d="m9.5 5 7 7-7 7" />';
                case 'caret-down': return '<path d="m5 9.5 7 7 7-7" />';
                case 'chevrons-up': return '<path d="m6 15 6-6 6 6" /><path d="m6 20 6-6 6 6" />';
                case 'chevrons-down': return '<path d="m6 4 6 6 6-6" /><path d="m6 10 6 6 6-6" />';
                case 'chevrons-down-up': return '<path d="m7 20 5-5 5 5" /><path d="m7 4 5 5 5-5" />';
                case 'chevrons-up-down': return '<path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />';
                case 'map': return '<path d="M4 6.75 9.5 4l5 2.25L20 4v13.25L14.5 20l-5-2.25L4 20Z" /><path d="M9.5 4v13.75" /><path d="M14.5 6.25V20" />';
                case 'bot': return '<path d="M12 3.5v3" /><path d="M8.5 2.75h7" /><rect x="4" y="7" width="16" height="11.5" rx="3" /><path d="M2.5 11.75H4" /><path d="M20 11.75h1.5" /><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M9 16h6" />';
                case 'settings': return '<path d="M12 8.25A3.75 3.75 0 1 1 8.25 12 3.75 3.75 0 0 1 12 8.25Z" /><path d="M12 3.25v2" /><path d="M12 18.75v2" /><path d="m19.42 6.58-1.42 1.42" /><path d="m6 18-1.42 1.42" /><path d="M20.75 12h-2" /><path d="M5.25 12h-2" /><path d="m19.42 17.42-1.42-1.42" /><path d="m6 6 1.42 1.42" />';
                case 'save': return '<path d="M5.25 3.5h11.5l3.25 3.25v12.5A2.75 2.75 0 0 1 17.25 22H6.75A2.75 2.75 0 0 1 4 19.25V4.75A1.25 1.25 0 0 1 5.25 3.5Z" /><path d="M8 3.5v5h7V5.75" /><path d="M8 20v-5.5h8V20" />';
                case 'menu': return '<path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />';
                case 'minus': return '<path d="M5 12h14" />';
                case 'plus': return '<path d="M12 5v14" /><path d="M5 12h14" />';
                case 'x': return '<path d="M6 6 18 18" /><path d="M18 6 6 18" />';
                case 'trash-2': return '<path d="M4 6h16" /><path d="M9 6V4.75A1.75 1.75 0 0 1 10.75 3h2.5A1.75 1.75 0 0 1 15 4.75V6" /><path d="M7 6v13.25A1.75 1.75 0 0 0 8.75 21h6.5A1.75 1.75 0 0 0 17 19.25V6" /><path d="M10 10v7" /><path d="M14 10v7" />';
                case 'search': return '<circle cx="11" cy="11" r="6.75" /><path d="m16 16 4.5 4.5" />';
                case 'download': return '<path d="M12 3.5v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 20.5h16" />';
                case 'puzzle': return '<path d="M9 4.5h3a2 2 0 1 1 4 0h2A1.5 1.5 0 0 1 19.5 6v3a2 2 0 1 0 0 4v3a1.5 1.5 0 0 1-1.5 1.5h-3a2 2 0 1 1-4 0H8A1.5 1.5 0 0 1 6.5 16v-3a2 2 0 1 0 0-4V6A1.5 1.5 0 0 1 8 4.5Z" />';
                case 'pin': return '<path d="M12 13.5v7" /><path d="M8.5 4.5h7a1.5 1.5 0 0 1 0 3h-.5v4l1.75 1.75A1 1 0 0 1 16.04 15H7.96a1 1 0 0 1-.71-1.75L9 11.5v-4h-.5a1.5 1.5 0 0 1 0-3Z" />';
                case 'file':
                case 'file-text': return '<path d="M7 3.5h7l4 4v13A2.5 2.5 0 0 1 15.5 23h-8A2.5 2.5 0 0 1 5 20.5V6A2.5 2.5 0 0 1 7.5 3.5Z" /><path d="M14 3.5V8h4" /><path d="M9 12h6" /><path d="M9 16h6" />';
                case 'chart-column': return '<path d="M5 20.5h14" /><path d="M7.5 20.5v-5" /><path d="M12 20.5V7.5" /><path d="M16.5 20.5V11" />';
                case 'alarm-clock': return '<circle cx="12" cy="13" r="6.5" /><path d="M12 10v3.25l2.25 1.5" /><path d="m7 4.75-2-2" /><path d="m17 4.75 2-2" />';
                case 'flag': return '<path d="M6 21V4.5" /><path d="M6 5.5c1.4-1.2 2.8-1.75 4.25-1.75 2.5 0 4.3 1.5 6.25 1.5.75 0 1.5-.12 2.25-.5v8.5c-.75.38-1.5.5-2.25.5-1.95 0-3.75-1.5-6.25-1.5-1.45 0-2.85.55-4.25 1.75" />';
                case 'brush-cleaning': return '<path d="M5 19h14" /><path d="M8 19c0-3.5 1.75-5.5 4-7.5 1.55-1.38 2.5-3.2 2.5-5.5a2.5 2.5 0 0 0-5 0v2.5A2.5 2.5 0 0 1 7 11H6.5A2.5 2.5 0 0 0 4 13.5V16a3 3 0 0 0 3 3" /><path d="M16 19c0-2.6 1.25-4.2 3-5.5" />';
                case 'undo-2': return '<path d="m9 9-5 5 5 5" /><path d="M4 14h9a6 6 0 0 1 0 12h-3" />';
                case 'check-circle-2': return '<circle cx="12" cy="12" r="9" /><path d="m8.75 12 2.25 2.25L15.5 9.5" />';
                case 'x-circle': return '<circle cx="12" cy="12" r="9" /><path d="M9 9 15 15" /><path d="M15 9 9 15" />';
                case 'triangle-alert': return '<path d="M12 4.5 20 18.5a1.75 1.75 0 0 1-1.52 2.63H5.52A1.75 1.75 0 0 1 4 18.5l8-14a1.75 1.75 0 0 1 3.04 0Z" /><path d="M12 9.5v4.5" /><path d="M12 17.25h.01" />';
                case 'timer':
                case 'clock-countdown': return '<path d="M9 3.5h6" /><path d="M12 7v1.5" /><circle cx="12" cy="14" r="6.5" /><path d="M12 14V11.25" /><path d="m12 14 3 1.75" />';
                case 'tag': return '<path d="M4 8.5v-3A2.5 2.5 0 0 1 6.5 3h5.25A2.5 2.5 0 0 1 13.52 3.73l6.75 6.75a2 2 0 0 1 0 2.82l-6.97 6.97a2 2 0 0 1-2.82 0L3.73 13.52A2.5 2.5 0 0 1 3 11.75V8.5Z" /><path d="M8 7.75h.01" />';
                case 'square-pen': return '<path d="M5.5 4h8.25" /><path d="M6 20h12.5A1.5 1.5 0 0 0 20 18.5V10" /><path d="M4 5.5v13A1.5 1.5 0 0 0 5.5 20H8" /><path d="m14.5 5.5 4-4a2.12 2.12 0 0 1 3 3l-8.75 8.75-3.5 1 1-3.5Z" />';
                case 'panel-left': return '<rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9 4v16" />';
                case 'map-pin': return '<path d="M12 21s6-5.27 6-10.25A6 6 0 1 0 6 10.75C6 15.73 12 21 12 21Z" /><path d="M12 8.75a2 2 0 1 1-2 2 2 2 0 0 1 2-2Z" />';
                case 'circle-dot': return '<circle cx="12" cy="12" r="8.75" /><circle cx="12" cy="12" r="1.25" />';
                case 'sparkle': return '<path d="m12 3.5 1.6 4.15L17.75 9.25l-4.15 1.6L12 15l-1.6-4.15-4.15-1.6 4.15-1.6Z" /><path d="m18.5 4.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" /><path d="m5 15.5.9 2.2 2.1.8-2.1.9L5 21.5l-.8-2.1-2.2-.9 2.2-.8Z" />';
                case 'dots-three': return '<path d="M6.25 12h.01" /><path d="M12 12h.01" /><path d="M17.75 12h.01" />';
                case 'caret-double-up': return '<path d="m6 15 6-6 6 6" /><path d="m6 20 6-6 6 6" />';
                case 'caret-double-down': return '<path d="m6 4 6 6 6-6" /><path d="m6 10 6 6 6-6" />';
                case 'minus': return '<path d="M6 12h12" />';
                default: return '<circle cx="12" cy="12" r="8.75"></circle>';
            }
        })();
        return `<svg class="${__tmEscAttr(className)}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"${styleAttr}><g fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
    }

    function __tmPhosphorBoldSvg(iconName, options = {}) {
        const normalizedName = __tmNormalizeLucideIconName(iconName);
        const size = Math.max(1, Number(options?.size) || 14);
        const className = String(options?.className || 'tm-phosphor-emoji__svg').trim();
        const style = String(options?.style || '').trim();
        const styleAttr = style ? ` style="${__tmEscAttr(style)}"` : '';
        const phosphorPath = __tmPhosphorBoldPaths[normalizedName];
        if (phosphorPath) {
            return `<svg class="${__tmEscAttr(className)}" viewBox="0 0 256 256" width="${size}" height="${size}" aria-hidden="true"${styleAttr}><path fill="currentColor" stroke="none" d="${phosphorPath}"></path></svg>`;
        }
        const body = (() => {
            switch (normalizedName) {
                case 'flag': return '<path d="M6 21V4.5" /><path d="M6 5.5c1.4-1.2 2.8-1.75 4.25-1.75 2.5 0 4.3 1.5 6.25 1.5.75 0 1.5-.12 2.25-.5v8.5c-.75.38-1.5.5-2.25.5-1.95 0-3.75-1.5-6.25-1.5-1.45 0-2.85.55-4.25 1.75" />';
                case 'circle-dot': return '<circle cx="12" cy="12" r="8.75" /><circle cx="12" cy="12" r="1.25" />';
                case 'x-circle': return '<circle cx="12" cy="12" r="9" /><path d="M9 9 15 15" /><path d="M15 9 9 15" />';
                case 'note-pencil': return '<path d="M18.5 4.5a2.12 2.12 0 0 1 3 3l-8.75 8.75-3.5 1 1-3.5Z" /><path d="M13.5 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H19a1.5 1.5 0 0 0 1.5-1.5V10" />';
                default: return '<circle cx="12" cy="12" r="8.75" />';
            }
        })();
        return `<svg class="${__tmEscAttr(className)}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"${styleAttr}><g fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
    }

    function __tmRenderLucideIcon(iconName, extraClass = '', options = {}) {
        const normalizedName = __tmNormalizeLucideIconName(iconName);
        const cls = `tm-lucide-emoji${extraClass ? ` ${extraClass}` : ''}`;
        return `<span class="${cls}" data-tm-lucide="${normalizedName}">${__tmLucideIconSvg(normalizedName, options)}</span>`;
    }

    function __tmRenderInlineIcon(iconName, options = {}) {
        const cls = ['tm-inline-icon', String(options?.className || '').trim()].filter(Boolean).join(' ');
        return `<span class="${cls}">${__tmLucideIconSvg(iconName, { ...options, className: 'tm-inline-icon__svg' })}</span>`;
    }

    function __tmGetHeadingLevelIconName(level) {
        return 'text-h';
    }

    function __tmRenderHeadingLevelInlineIcon(level, options = {}) {
        const cls = ['tm-inline-icon', String(options?.className || '').trim()].filter(Boolean).join(' ');
        const iconName = __tmGetHeadingLevelIconName(level);
        const size = Math.max(1, Number(options?.size) || 14);
        return `<span class="${cls}">${__tmPhosphorBoldSvg(iconName, { ...options, size, className: 'tm-inline-icon__svg' })}</span>`;
    }

    function __tmRenderHeadingLevelIconLabel(text, level, options = {}) {
        const cls = ['tm-icon-label', String(options?.className || '').trim()].filter(Boolean).join(' ');
        const style = String(options?.style || '').trim();
        const styleAttr = style ? ` style="${__tmEscAttr(style)}"` : '';
        return `<span class="${cls}"${styleAttr}>${__tmRenderHeadingLevelInlineIcon(level, { size: options?.size || 14 })}<span>${esc(String(text || ''))}</span></span>`;
    }

    function __tmRenderIconLabel(iconName, text, options = {}) {
        const cls = ['tm-icon-label', String(options?.className || '').trim()].filter(Boolean).join(' ');
        const style = String(options?.style || '').trim();
        const styleAttr = style ? ` style="${__tmEscAttr(style)}"` : '';
        return `<span class="${cls}"${styleAttr}>${__tmRenderInlineIcon(iconName, { size: options?.size || 14 })}<span>${esc(String(text || ''))}</span></span>`;
    }

    function __tmRenderBadgeIcon(iconName, size = 12) {
        return __tmLucideIconSvg(iconName, { size, className: 'tm-badge__icon-svg' });
    }

    function __tmRenderToggleIcon(size = 16, rotateDeg = 0, className = 'tm-tree-toggle-icon', extraStyle = '') {
        const rotate = Number.isFinite(Number(rotateDeg)) ? `transform:rotate(${Number(rotateDeg)}deg);` : '';
        return __tmLucideIconSvg('caret-right', {
            size,
            className,
            style: `${rotate}${String(extraStyle || '')}`.trim(),
        });
    }

    function __tmRenderReminderIcon() {
        return `<span class="tm-task-reminder-emoji"${__tmBuildTooltipAttrs('已添加提醒', { side: 'bottom', ariaLabel: false })}>${__tmLucideIconSvg('alarm-clock', { size: 13, className: 'tm-task-reminder-emoji__svg' })}</span>`;
    }

    function __tmRenderRemarkIcon(remark) {
        const text = String(remark || '').trim();
        if (!text) return '';
        const tip = `备注: ${text}`;
        return `<span class="tm-task-remark-emoji"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}>${__tmLucideIconSvg('square-pen', { size: 13, className: 'tm-task-remark-emoji__svg' })}</span>`;
    }

    function __tmRenderTaskAttachmentIcon(task) {
        const count = __tmGetTaskAttachmentPaths(task).length;
        if (!count) return '';
        const tip = count > 1 ? `附件: ${count} 个` : '附件';
        return `<span class="tm-task-attachment-emoji"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}>${__tmPhosphorBoldSvg('paperclip', { size: 13, className: 'tm-task-attachment-emoji__svg' })}</span>`;
    }

    function __tmRenderContextMenuLabel(iconName, text, options = {}) {
        const iconHtml = options.iconHtml || __tmRenderLucideIcon(iconName, '', { size: options.size || 14 });
        return `<span style="display:inline-flex;align-items:center;gap:8px;min-width:0;"><span style="display:inline-flex;align-items:center;justify-content:center;line-height:0;flex:0 0 auto;">${iconHtml}</span><span>${esc(String(text || ''))}</span></span>`;
    }

    function __tmRenderTaskHorizonTopbarIcon(size = 18) {
        const iconSize = Math.max(1, Number(size) || 18);
        return `<svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" aria-hidden="true" style="display:block;fill:none;flex:0 0 auto;"><use href="#iconTaskHorizon" xlink:href="#iconTaskHorizon"></use></svg>`;
    }

    function __tmRenderHomepageEntryIcon(size = 16) {
        const iconSize = Math.max(1, Number(size) || 16);
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 256 256" aria-hidden="true" style="display:block;fill:currentColor;flex:0 0 auto;"><path d="M240,204H228V144a12,12,0,0,0,12.49-19.78L142.14,25.85a20,20,0,0,0-28.28,0L15.51,124.2A12,12,0,0,0,28,144v60H16a12,12,0,0,0,0,24H240a12,12,0,0,0,0-24ZM52,121.65l76-76,76,76V204H164V152a12,12,0,0,0-12-12H104a12,12,0,0,0-12,12v52H52ZM140,204H116V164h24Z"></path></svg>`;
    }

    window.tmHandleManagerTitleClick = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        window.tmToggleDocTabs(ev);
    };

    window.tmHandleManagerIconClick = async function(ev) {
        if (Number(state.topbarManagerIconSuppressClickUntil || 0) > Date.now()) {
            state.topbarManagerIconSuppressClickUntil = 0;
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return;
        }
        if (state.topbarManagerIconLongPressFired) {
            state.topbarManagerIconLongPressFired = false;
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return;
        }
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        try {
            window.tmShowAllDocTabMenu?.(ev);
        } catch (e) {}
    };

    window.tmHandleManagerIconContextMenu = function(ev) {
        if (Number(state.topbarManagerIconIgnoreContextMenuUntil || 0) > Date.now()) {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return false;
        }
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try {
            window.tmToggleDocTabs?.(ev);
        } catch (e) {}
        return false;
    };

    window.tmTopbarManagerIconPressStart = function(event) {
        const type = String(event?.type || '').trim();
        if (type.startsWith('mouse') && Number(event?.button) !== 0) return;
        __tmClearTopbarManagerIconLongPressTimer();
        state.topbarManagerIconLongPressFired = false;
        state.topbarManagerIconLongPressMoved = false;
        state.topbarManagerIconSuppressClickUntil = 0;
        state.topbarManagerIconIgnoreContextMenuUntil = 0;
        state.topbarManagerIconTrigger = event?.currentTarget instanceof HTMLElement
            ? event.currentTarget
            : (event?.target instanceof HTMLElement ? event.target.closest('[data-tm-all-doc-menu-trigger="1"]') : null);
        const point = event?.touches?.[0] || event;
        state.topbarManagerIconLongPressStartX = Number(point?.clientX) || 0;
        state.topbarManagerIconLongPressStartY = Number(point?.clientY) || 0;
        try { state.__tmPluginIconLongPressing = true; } catch (e) {}
        state.topbarManagerIconLongPressTimer = setTimeout(() => {
            if (state.topbarManagerIconLongPressMoved) return;
            state.topbarManagerIconLongPressFired = true;
            state.topbarManagerIconSuppressClickUntil = Date.now() + 700;
            state.topbarManagerIconIgnoreContextMenuUntil = Date.now() + 1200;
            const trigger = state.topbarManagerIconTrigger;
            window.tmToggleDocTabs?.({
                currentTarget: trigger,
                target: trigger,
                preventDefault() {},
                stopPropagation() {},
            });
        }, 460);
    };

    window.tmTopbarManagerIconPressMove = function(event) {
        if (!state.topbarManagerIconLongPressTimer) return;
        const point = event?.touches?.[0] || event;
        const x = Number(point?.clientX) || 0;
        const y = Number(point?.clientY) || 0;
        const dx = x - (Number(state.topbarManagerIconLongPressStartX) || 0);
        const dy = y - (Number(state.topbarManagerIconLongPressStartY) || 0);
        if (Math.abs(dx) + Math.abs(dy) > 10) {
            state.topbarManagerIconLongPressMoved = true;
            __tmClearTopbarManagerIconLongPressTimer();
            try { state.__tmPluginIconLongPressing = false; } catch (e) {}
        }
    };

    window.tmTopbarManagerIconPressEnd = function(event) {
        __tmFinishTopbarManagerIconLongPress(event);
    };

    // 修改渲染函数以显示规则信息
