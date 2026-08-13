    window.tmSetTaskPriority = async function(id, value, opts = {}) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const raw = String(value || '').trim().toLowerCase();
        const next = raw === 'high' || raw === 'medium' || raw === 'low' ? raw : '';
        const shouldWait = options.wait === true || options.forceImmediate === true;
        const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
        if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
        const result = patchTask(tid, { priority: next }, {
            source: String(options.source || 'external-priority').trim() || 'external-priority',
            label: '重要性',
            skipDetailPatch: options.skipDetailPatch === true,
            defer: options.defer === true,
            forceImmediate: options.forceImmediate === true,
            background: options.forceImmediate === true ? undefined : true,
            wait: shouldWait ? true : false,
            queueDelayMs: Object.prototype.hasOwnProperty.call(options, 'queueDelayMs') ? options.queueDelayMs : undefined,
            skipInteractionGate: options.skipInteractionGate === true || !shouldWait,
            showErrorHint: options.silent !== true,
        });
        if (shouldWait) {
            const waitedResult = await result;
            if (waitedResult !== false && options.silent !== true) {
                const label = next === 'high' ? '高' : (next === 'medium' ? '中' : (next === 'low' ? '低' : '无'));
                hint(`✅ 重要性已更新为${label}`, 'success');
            }
            return waitedResult !== false;
        }
        Promise.resolve(result).catch((e) => {
            if (options.silent !== true) hint(`❌ 更新失败: ${e.message}`, 'error');
        });
        return true;
    };

    window.tmSetTaskCompletionTime = async function(id, value, opts = {}) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const raw = String(value || '').trim();
        const next = raw ? __tmNormalizeDateOnly(raw) : '';
        if (raw && !next) {
            if (options.silent !== true) hint('⚠ 日期格式无效，请使用 YYYY-MM-DD', 'warning');
            return false;
        }
        const shouldWait = options.wait === true || options.forceImmediate === true;
        const updateTaskDates = window.tmUpdateTaskDates;
        if (typeof updateTaskDates !== 'function') throw new Error('任务日期写入服务未就绪');
        const result = updateTaskDates(tid, { completionTime: next }, {
            source: String(options.source || 'external-completion-time').trim() || 'external-completion-time',
            skipDetailPatch: options.skipDetailPatch === true,
            background: options.forceImmediate === true ? false : true,
            wait: shouldWait ? true : false,
            skipInteractionGate: options.skipInteractionGate === true || !shouldWait,
            skipNoopCheck: options.skipNoopCheck === true || !next,
            renderOptimistic: true,
        });
        if (shouldWait) {
            const waitedResult = await result;
            if (waitedResult !== false && options.silent !== true) hint(next ? '✅ 截止日期已更新' : '✅ 截止日期已清空', 'success');
            return waitedResult !== false;
        }
        Promise.resolve(result).catch((e) => {
            if (options.silent !== true) hint(`❌ 更新失败: ${e.message}`, 'error');
        });
        return true;
    };

    function __tmOpenPriorityInlinePicker(anchorEl, options = {}) {
        if (!(anchorEl instanceof HTMLElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const currentValue = String(opts.currentValue || '').trim();
        const currentKey = String(__tmGetPriorityJiraInfo(currentValue)?.key || 'none').trim() || 'none';
        const onPick = typeof opts.onPick === 'function' ? opts.onPick : null;
        const waitForPickBeforeClose = opts.waitForPickBeforeClose === true;
        if (!onPick) return;

        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            editor.style.minWidth = '60px';
            editor.style.width = '60px';
            editor.style.padding = '8px';
            if (Number.isFinite(Number(opts.zIndex)) && Number(opts.zIndex) > 0) {
                editor.style.zIndex = String(Math.round(Number(opts.zIndex)));
            }
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';
            const mk = (value) => {
                const info = __tmGetPriorityJiraInfo(value);
                const key = String(info?.key || 'none').trim() || 'none';
                const color = __tmGetPriorityAccentColor(key) || '#9e9e9e';
                const active = key === currentKey;
                const b = document.createElement('button');
                b.className = `tm-priority-option-btn${active ? ' is-active' : ''}`;
                b.type = 'button';
                b.style.fontSize = '12px';
                b.style.textAlign = 'center';
                b.style.setProperty('--tm-priority-option-color', color);
                b.style.setProperty('--tm-priority-option-bg', active
                    ? `color-mix(in srgb, ${color} 14%, var(--tm-bg-color))`
                    : 'transparent');
                b.style.setProperty('--tm-priority-option-border', active
                    ? color
                    : `color-mix(in srgb, ${color} 34%, var(--tm-border-color) 66%)`);
                b.style.setProperty('--tm-priority-option-hover-bg', `color-mix(in srgb, ${color} 14%, var(--tm-hover-bg) 86%)`);
                b.style.setProperty('--tm-priority-option-hover-border', color);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
                b.innerHTML = __tmRenderPriorityJira(key === 'none' ? '' : key, true);
                b.onclick = waitForPickBeforeClose ? async () => {
                    try {
                        await onPick(key === 'none' ? '' : key, info);
                        close();
                    } catch (e) {
                        const msg = String(e?.message || e || '').trim() || '未知错误';
                        hint(`❌ 更新失败: ${msg}`, 'error');
                    }
                } : () => {
                    const request = Promise.resolve(onPick(key === 'none' ? '' : key, info));
                    close();
                    request.catch((e) => {
                        const msg = String(e?.message || e || '').trim() || '未知错误';
                        hint(`❌ 更新失败: ${msg}`, 'error');
                    });
                };
                return b;
            };
            wrap.appendChild(mk(''));
            wrap.appendChild(mk('high'));
            wrap.appendChild(mk('medium'));
            wrap.appendChild(mk('low'));
            editor.appendChild(wrap);
        });
    }

    window.tmPickPriority = function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!task) return;
        let patchTask = null;
        try { patchTask = globalThis.__tmRequireTaskMutation?.('patchTask'); } catch (e) { patchTask = null; }
        __tmOpenPriorityInlinePicker(el, {
            currentValue: task.priority,
            onPick: (value) => {
                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                return patchTask(tid, { priority: value || '' }, {
                    source: 'inline-priority',
                    label: '重要性',
                });
            },
        });
    };

    window.tmOpenStatusSelect = function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const el = ev.target.closest('td');
        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!task || !el) return;
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const options = SettingsStore.data.customStatusOptions || [];
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || '').length), 0);
            const w = Math.min(220, Math.max(92, maxLen * 12 + 22));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt.color);
                chip.textContent = String(opt?.name || opt?.id || '');
                b.appendChild(chip);
                b.onclick = () => {
                    close();
                    const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
                    if (typeof patchTask !== 'function') {
                        hint('❌ 更新失败: 任务写入队列未就绪: patchTask', 'error');
                        return;
                    }
                    void patchTask(tid, { customStatus: opt.id }, {
                        source: 'inline-status',
                        label: '状态',
                    }).catch((error) => {
                        hint(`❌ 更新失败: ${error.message}`, 'error');
                    });
                };
                wrap.appendChild(b);
            });

            editor.appendChild(wrap);
        });
    };

    function __tmApplyTaskCustomFieldValueLocally(task, field, nextValue) {
        if (!(task && typeof task === 'object')) return;
        const def = (field && typeof field === 'object') ? field : {};
        const fieldId = String(def.id || '').trim();
        if (!fieldId) return;
        const normalized = __tmNormalizeCustomFieldValue(def, nextValue);
        const serialized = __tmSerializeCustomFieldValue(def, normalized);
        const nextValues = {
            ...((task.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues)) ? task.customFieldValues : {})
        };
        const nextRawValues = {
            ...((task.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues)) ? task.__customFieldRawValues : {})
        };
        if (Array.isArray(normalized)) {
            if (normalized.length) nextValues[fieldId] = normalized;
            else delete nextValues[fieldId];
        } else if (String(normalized || '').trim()) {
            nextValues[fieldId] = normalized;
        } else {
            delete nextValues[fieldId];
        }
        if (serialized) nextRawValues[fieldId] = serialized;
        else delete nextRawValues[fieldId];
        task.customFieldValues = nextValues;
        task.__customFieldRawValues = nextRawValues;
    }

    async function __tmPersistTaskCustomFieldValue(taskId, fieldId, nextValue, options = {}) {
        const tid = String(taskId || '').trim();
        const fid = String(fieldId || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        const field = __tmGetCustomFieldDefMap().get(fid);
        if (!tid || !task || !field || !__tmIsCustomFieldApplicableToTask(field, task)) return false;
        const normalized = __tmNormalizeCustomFieldValue(field, nextValue);
        const opts = (options && typeof options === 'object') ? options : {};
        const previewAnchorEl = opts.anchorEl instanceof Element ? opts.anchorEl : null;
        if (previewAnchorEl instanceof Element) {
            const valueWrap = previewAnchorEl.querySelector('.tm-task-detail-custom-field-value');
            if (valueWrap instanceof HTMLElement) {
                valueWrap.innerHTML = __tmBuildCustomFieldDisplayHtml(field, normalized, {
                    emptyText: '未设置',
                    maxTags: String(field?.type || '').trim() === 'multi' ? 3 : 1,
                });
            }
        }
        const shouldWait = opts.wait === true || opts.forceImmediate === true;
        const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
        if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
        const savePromise = patchTask(tid, {
                customFieldValues: { [fid]: normalized }
            }, {
                source: String(opts.source || 'custom-field').trim() || 'custom-field',
                label: String(field?.name || '自定义列').trim() || '自定义列',
                background: shouldWait ? opts.background : true,
                wait: shouldWait ? opts.wait : false,
                defer: opts.defer === true,
                skipInteractionGate: opts.skipInteractionGate === true || !shouldWait,
                skipDetailPatch: opts.skipDetailPatch === true,
                allowMountedInactive: opts.allowMountedInactive === true,
                broadcast: opts.broadcast !== false,
            });
        if (!shouldWait) {
            Promise.resolve(savePromise).catch((e) => {
                if (opts.silent !== true) {
                    try { hint(`❌ 更新失败: ${e.message}`, 'error'); } catch (err) {}
                }
            });
            if (typeof opts.onAfterSave === 'function') {
                try { opts.onAfterSave(normalized, field); } catch (e) {}
            }
            return true;
        }
        const result = await savePromise;
        if (result !== false && typeof opts.onAfterSave === 'function') {
            try { opts.onAfterSave(normalized, field); } catch (e) {}
        }
        return result !== false;
    }

    function __tmGetDefaultExpandedCustomFieldOptionIds(field) {
        const runtime = __tmBuildCustomFieldOptionRuntime(field);
        const expandedIds = new Set();
        runtime.options.forEach((option) => {
            const optionId = String(option?.id || '').trim();
            if (!optionId || runtime.effectiveArchivedById.get(optionId) === true) return;
            const hasActiveChildren = (runtime.childrenByParentId.get(optionId) || [])
                .some((child) => runtime.effectiveArchivedById.get(String(child?.id || '').trim()) !== true);
            if (hasActiveChildren) expandedIds.add(optionId);
        });
        return expandedIds;
    }

    function __tmRenderCustomFieldOptionTreePicker(container, field, selectedIds, options = {}) {
        if (!(container instanceof HTMLElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const selected = selectedIds instanceof Set ? selectedIds : new Set();
        const expandedIds = opts.expandedIds instanceof Set ? opts.expandedIds : new Set();
        const runtime = __tmBuildCustomFieldOptionRuntime(field);
        const useTouchLayout = (() => {
            try { return typeof __tmIsMobileDevice === 'function' && __tmIsMobileDevice(); } catch (e) { return false; }
        })();
        const expandColumnWidth = useTouchLayout ? 36 : 22;
        const optionRowHeight = useTouchLayout ? 36 : 30;
        const activeChildren = (parentId) => (runtime.childrenByParentId.get(parentId) || [])
            .filter((option) => runtime.effectiveArchivedById.get(String(option?.id || '').trim()) !== true);
        const historicalIds = Array.from(selected).filter((id) => {
            const option = runtime.optionById.get(id);
            return !option || runtime.effectiveArchivedById.get(id) === true;
        });
        container.innerHTML = '';
        container.style.cssText = 'display:flex;flex-direction:column;gap:2px;align-items:stretch;width:100%;max-width:100%;max-height:min(300px,50vh);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;';

        const appendSectionLabel = (text) => {
            const label = document.createElement('div');
            label.style.cssText = 'padding:5px 5px 3px;color:var(--tm-secondary-text);font-size:11px;font-weight:600;';
            label.textContent = text;
            container.appendChild(label);
        };
        if (historicalIds.length) {
            appendSectionLabel('已归档或历史值');
            historicalIds.forEach((optionId) => {
                const option = runtime.optionById.get(optionId);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'tm-status-option-btn tm-custom-field-inline-option is-historical';
                button.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:${optionRowHeight}px;padding:4px 6px;text-align:left;opacity:.72;`;
                button.title = '从当前任务中移除此历史值';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag tm-custom-field-inline-chip';
                chip.style.cssText = __tmBuildStatusChipStyle(option?.color || '#9ca3af');
                chip.textContent = runtime.pathById.get(optionId) || String(option?.name || optionId || '').trim() || optionId;
                const remove = document.createElement('span');
                remove.textContent = '×';
                remove.setAttribute('aria-hidden', 'true');
                button.append(chip, remove);
                button.onclick = () => opts.onToggle?.(optionId, { historical: true });
                container.appendChild(button);
            });
        }

        const rootOptions = activeChildren('');
        const appendNode = (option) => {
            const optionId = String(option?.id || '').trim();
            const depth = Number(runtime.depthById.get(optionId) || 0);
            const children = activeChildren(optionId);
            const row = document.createElement('div');
            row.className = 'tm-custom-field-picker-tree-row';
            row.style.cssText = `display:grid;grid-template-columns:minmax(0,1fr) ${expandColumnWidth}px;align-items:center;gap:2px;box-sizing:border-box;width:100%;min-width:0;padding-left:${depth * 14}px;`;
            const expand = document.createElement('button');
            expand.type = 'button';
            expand.className = 'tm-custom-field-picker-expand';
            expand.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${expandColumnWidth}px;height:${optionRowHeight}px;padding:0;border:0;background:transparent;color:var(--tm-secondary-text);cursor:pointer;`;
            if (children.length) {
                expand.innerHTML = __tmRenderLucideIcon('chevron-right');
                const icon = expand.firstElementChild;
                if (icon) {
                    icon.style.transition = 'transform .12s ease';
                    icon.style.transform = expandedIds.has(optionId) ? 'rotate(90deg)' : '';
                }
                expand.title = expandedIds.has(optionId) ? '收起子项' : '展开子项';
                expand.setAttribute('aria-expanded', expandedIds.has(optionId) ? 'true' : 'false');
                expand.onclick = () => {
                    if (expandedIds.has(optionId)) expandedIds.delete(optionId);
                    else expandedIds.add(optionId);
                    __tmRenderCustomFieldOptionTreePicker(container, field, selected, opts);
                };
            } else {
                expand.disabled = true;
                expand.style.visibility = 'hidden';
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tm-status-option-btn tm-custom-field-inline-option';
            button.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0;height:${optionRowHeight}px;padding:4px 6px;text-align:left;`;
            button.setAttribute('data-selected', selected.has(optionId) ? 'true' : 'false');
            button.setAttribute('aria-selected', selected.has(optionId) ? 'true' : 'false');
            const chip = document.createElement('span');
            chip.className = 'tm-status-tag tm-custom-field-inline-chip';
            chip.style.cssText = __tmBuildStatusChipStyle(option?.color || '#9ca3af');
            chip.textContent = String(option?.name || optionId || '').trim() || optionId;
            const check = document.createElement('span');
            check.style.cssText = 'flex:none;color:var(--tm-primary-color);font-size:12px;';
            check.textContent = selected.has(optionId) ? '✓' : '';
            button.append(chip, check);
            button.onclick = () => opts.onToggle?.(optionId, { historical: false });
            row.append(button, expand);
            container.appendChild(row);
            if (children.length && expandedIds.has(optionId)) children.forEach(appendNode);
        };
        rootOptions.forEach(appendNode);
        if (!rootOptions.length && !historicalIds.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:8px;color:var(--tm-secondary-text);font-size:12px;';
            empty.textContent = '当前字段没有可选项';
            container.appendChild(empty);
        }
    }

    function __tmOpenCustomFieldInlineEditor(taskId, fieldId, anchorEl, options = {}) {
        const tid = String(taskId || '').trim();
        const fid = String(fieldId || '').trim();
        const field = __tmGetCustomFieldDefMap().get(fid);
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!(anchorEl instanceof Element) || !field || !task || !__tmIsCustomFieldApplicableToTask(field, task)) return;
        const selected = __tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fid));
        const isMulti = String(field.type || '').trim() === 'multi';
        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            try { editor.classList.add('tm-custom-field-inline-editor'); } catch (e) {}
            const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
            const minEditorWidth = 88;
            const maxEditorWidth = Math.max(minEditorWidth, Math.min(300, viewportWidth - 24));
            editor.style.minWidth = '0';
            editor.style.width = 'auto';
            editor.style.maxWidth = `${maxEditorWidth}px`;
            editor.style.padding = '6px';
            const wrap = document.createElement('div');
            wrap.className = 'tm-custom-field-inline-wrap';
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '2px';
            wrap.style.alignItems = 'stretch';
            wrap.style.width = '100%';
            wrap.style.maxWidth = '100%';

            const title = document.createElement('div');
            title.className = 'tm-custom-field-inline-title';
            title.style.fontSize = '12px';
            title.style.color = 'var(--tm-secondary-text)';
            title.style.maxWidth = '100%';
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.textContent = String(field.name || field.id || '自定义列').trim() || '自定义列';
            wrap.appendChild(title);

            const list = document.createElement('div');
            list.className = 'tm-custom-field-inline-list';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '2px';
            list.style.alignItems = 'stretch';
            list.style.width = '100%';
            list.style.maxWidth = '100%';
            wrap.appendChild(list);

            let actions = null;
            const syncEditorWidth = () => {
                try {
                    editor.style.width = 'auto';
                    const optionWidth = Array.from(list.children || []).reduce((max, item) => {
                        const chip = item instanceof HTMLElement ? item.querySelector('.tm-custom-field-inline-chip') : null;
                        const width = Math.ceil((chip?.scrollWidth || item?.scrollWidth || 0) + 20);
                        return Math.max(max, width);
                    }, 0);
                    const actionButtons = actions ? Array.from(actions.children || []).filter((item) => item instanceof HTMLElement) : [];
                    const actionWidth = actionButtons.reduce((sum, item) => sum + Math.ceil(item.scrollWidth || 0), 0)
                        + Math.max(0, actionButtons.length - 1) * 2;
                    const naturalWidth = Math.max(
                        minEditorWidth,
                        Math.ceil((title.scrollWidth || 0) + 8),
                        optionWidth,
                        actionWidth
                    );
                    editor.style.width = `${Math.min(maxEditorWidth, naturalWidth)}px`;
                } catch (e) {}
            };

            const draft = new Set(Array.isArray(selected) ? selected : (String(selected || '').trim() ? [String(selected || '').trim()] : []));
            const expandedIds = __tmGetDefaultExpandedCustomFieldOptionIds(field);
            const renderOptions = () => {
                __tmRenderCustomFieldOptionTreePicker(list, field, draft, {
                    expandedIds,
                    onToggle: (optionId) => {
                        if (isMulti) {
                            const nextDraft = new Set(draft);
                            if (nextDraft.has(optionId)) nextDraft.delete(optionId);
                            else if (optionId) nextDraft.add(optionId);
                            void (async () => {
                                try {
                                    const ok = await __tmPersistTaskCustomFieldValue(tid, fid, Array.from(nextDraft), options);
                                    if (ok === false) {
                                        hint('❌ 更新失败', 'error');
                                        return;
                                    }
                                    draft.clear();
                                    nextDraft.forEach((value) => draft.add(value));
                                    renderOptions();
                                } catch (e) {
                                    hint(`❌ 更新失败: ${e.message}`, 'error');
                                }
                            })();
                            return;
                        }
                        const nextValue = draft.has(optionId) ? '' : optionId;
                        close();
                        void __tmPersistTaskCustomFieldValue(tid, fid, nextValue, options);
                    },
                });
                syncEditorWidth();
            };
            renderOptions();

            actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions tm-custom-field-inline-actions';
            actions.style.display = 'flex';
            actions.style.justifyContent = 'flex-start';
            actions.style.width = '100%';
            actions.style.alignSelf = 'stretch';
            actions.style.boxSizing = 'border-box';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'tm-btn tm-btn-secondary tm-custom-field-inline-action';
            clearBtn.style.padding = '0 10px';
            clearBtn.textContent = '清空';
            clearBtn.onclick = () => {
                if (isMulti) {
                    void (async () => {
                        try {
                            const ok = await __tmPersistTaskCustomFieldValue(tid, fid, [], options);
                            if (ok === false) {
                                hint('❌ 更新失败', 'error');
                                return;
                            }
                            draft.clear();
                            renderOptions();
                        } catch (e) {
                            hint(`❌ 更新失败: ${e.message}`, 'error');
                        }
                    })();
                    return;
                }
                close();
                void __tmPersistTaskCustomFieldValue(tid, fid, '', options);
            };
            actions.appendChild(clearBtn);
            if (isMulti) {
                const doneBtn = document.createElement('button');
                doneBtn.type = 'button';
                doneBtn.className = 'tm-btn tm-btn-primary tm-custom-field-inline-action';
                doneBtn.style.padding = '0 10px';
                doneBtn.textContent = '完成';
                doneBtn.onclick = () => close();
                actions.appendChild(doneBtn);
            }
            wrap.appendChild(actions);
            editor.appendChild(wrap);
            syncEditorWidth();
        });
    }

    window.tmOpenCustomFieldSelect = function(id, fieldId, ev, anchorEl = null, options = {}) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const anchor = anchorEl instanceof Element ? anchorEl : ev?.target?.closest?.('td,button,[data-tm-custom-field-anchor]');
        if (!(anchor instanceof Element)) return;
        __tmOpenCustomFieldInlineEditor(id, fieldId, anchor, options);
    };

    window.tmKanbanOpenStatusSelect = function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!task || !(el instanceof Element)) return;

        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const options = SettingsStore.data.customStatusOptions || [];
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || '').length), 0);
            const w = Math.min(220, Math.max(92, maxLen * 12 + 22));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt.color);
                chip.textContent = String(opt?.name || opt?.id || '');
                b.appendChild(chip);
                b.onclick = () => {
                    close();
                    const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
                    if (typeof patchTask !== 'function') {
                        hint('❌ 更新失败: 任务写入队列未就绪: patchTask', 'error');
                        return;
                    }
                    void patchTask(tid, { customStatus: opt.id }, {
                        source: 'kanban-status',
                        label: '状态',
                    }).catch((error) => {
                        hint(`❌ 更新失败: ${error.message}`, 'error');
                    });
                };
                wrap.appendChild(b);
            });
            editor.appendChild(wrap);
        });
    };
