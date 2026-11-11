    const __TM_CUSTOM_BOARD_VIEW_MODE = 'comboBoard';
    const __TM_CUSTOM_BOARD_PROJECTION_CACHE_LIMIT = 8;
    const __tmCustomBoardScopeMemoryCache = new Map();
    const __tmCustomBoardProjectionCache = new Map();
    let __tmCustomBoardProjectionRefreshTimer = 0;

    function __tmIsCustomBoardShellContext(modeInput = '') {
        const mode = String(modeInput || '').trim();
        return mode === __TM_CUSTOM_BOARD_VIEW_MODE
            || (mode === 'home'
                && state.homepageOpen === true
                && String(state.viewMode || '').trim() === __TM_CUSTOM_BOARD_VIEW_MODE);
    }

    function __tmCustomBoardUsesHeadingGroups(board) {
        return __tmNormalizeCustomBoardGroupMode(board?.groupMode) === 'doc'
            && __tmNormalizeCustomBoardScope(board?.scope).mode === 'docs';
    }

    function __tmRememberCustomBoardReturnScope() {
        const groupId = String(SettingsStore.data.currentGroupId || 'all');
        const docIds = __tmNormalizeDocScopeDocIds(state.__tmLoadedDocIdsForTasks || []);
        if (!docIds.length) return;
        __tmRememberDocSessionTaskEntries(state.taskTree, { docIds });
        state.__tmCustomBoardReturnScope = { groupId, docIds, key: __tmBuildDocGroupScopeKey(groupId) };
    }

    function __tmTryRestoreCustomBoardReturnScope() {
        const scope = state.__tmCustomBoardReturnScope;
        const groupId = String(SettingsStore.data.currentGroupId || 'all');
        if (!scope || scope.groupId !== groupId || scope.key !== __tmBuildDocGroupScopeKey(groupId)) return false;
        const restored = __tmRestoreDocSessionTaskState({
            docIds: scope.docIds, groupId,
            docUpdatedMap: __tmBuildDocUpdatedFingerprintMap(state.allDocuments),
        });
        if (!restored) return false;
        try { recalcStats(); } catch (e) {}
        __tmRecomputeTaskProjection({ reason: 'custom-board-return-cache' });
        __tmScheduleSilentCacheVerifyAfterFirstPaint({ source: 'custom-board-return-cache', delayMs: 520 });
        return true;
    }

    function __tmCreateCustomBoardId(prefix = 'board') {
        const head = String(prefix || 'board').trim() || 'board';
        return `${head}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function __tmNormalizeCustomBoardScope(input = null) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const mode = ['all', 'groups', 'tabGroup', 'docs'].includes(String(source.mode || '').trim())
            ? String(source.mode).trim()
            : 'all';
        const uniqueIds = (value) => Array.from(new Set((Array.isArray(value) ? value : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (mode === 'groups') {
            return { mode, groupIds: uniqueIds(source.groupIds) };
        }
        if (mode === 'tabGroup') {
            return {
                mode,
                groupId: String(source.groupId || 'all').trim() || 'all',
                tabGroupId: String(source.tabGroupId || '').trim(),
            };
        }
        if (mode === 'docs') {
            return {
                mode,
                docIds: uniqueIds(source.docIds).filter((id) => typeof __tmIsLikelyBlockId !== 'function' || __tmIsLikelyBlockId(id)),
            };
        }
        return { mode: 'all' };
    }

    function __tmNormalizeCustomBoardSets(input) {
        const source = Array.isArray(input) ? input : [];
        const seenSetIds = new Set();
        return source.reduce((sets, rawSet) => {
            if (!rawSet || typeof rawSet !== 'object') return sets;
            const id = String(rawSet.id || '').trim();
            if (!id || seenSetIds.has(id)) return sets;
            seenSetIds.add(id);
            const legacyGroupMode = __tmNormalizeCustomBoardGroupMode(
                rawSet.groupMode,
                __tmNormalizeCustomBoardGroupMode(SettingsStore?.data?.customBoardGroupMode, 'doc')
            );
            const seenBoardIds = new Set();
            const boards = (Array.isArray(rawSet.boards) ? rawSet.boards : []).reduce((items, rawBoard) => {
                if (!rawBoard || typeof rawBoard !== 'object') return items;
                const boardId = String(rawBoard.id || '').trim();
                if (!boardId || seenBoardIds.has(boardId)) return items;
                seenBoardIds.add(boardId);
                const color = typeof __tmNormalizeHexColor === 'function'
                    ? __tmNormalizeHexColor(rawBoard.color, '')
                    : String(rawBoard.color || '').trim();
                items.push({
                    id: boardId,
                    name: String(rawBoard.name || '').trim() || __tmT("task.untitledSubBoard"),
                    ruleId: String(rawBoard.ruleId || '').trim(),
                    groupMode: __tmNormalizeCustomBoardGroupMode(rawBoard.groupMode, legacyGroupMode),
                    color: color || '',
                    scope: __tmNormalizeCustomBoardScope(rawBoard.scope),
                });
                return items;
            }, []);
            sets.push({
                id,
                name: String(rawSet.name || '').trim() || __tmT("task.untitledBoardSet"),
                boards,
            });
            return sets;
        }, []);
    }

    function __tmCanCreateAdditionalCustomBoardSet(setsInput = null) {
        const sets = Array.isArray(setsInput) ? setsInput : __tmGetCustomBoardSets();
        if (sets.length < 1) return true;
        try {
            return typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro') === true;
        } catch (e) {
            return false;
        }
    }

    async function __tmCanCreateAdditionalCustomBoardSetAfterLicenseCheck(setsInput = null) {
        if (__tmCanCreateAdditionalCustomBoardSet(setsInput)) return true;
        let licenseState = null;
        try { licenseState = window.tmGetLicenseState?.() || null; } catch (e) {}
        if (licenseState?.loaded !== true) {
            try { await window.tmLicenseLoad?.(); } catch (e) {}
        }
        return __tmCanCreateAdditionalCustomBoardSet(setsInput);
    }

    function __tmGetCustomBoardSets() {
        const sets = __tmNormalizeCustomBoardSets(SettingsStore?.data?.customBoardSets);
        try { SettingsStore.data.customBoardSets = sets; } catch (e) {}
        return sets;
    }

    function __tmGetCustomBoardSetLicenseGate() {
        let licenseState = null;
        try { licenseState = window.tmGetLicenseState?.() || null; } catch (e) {}
        if (!licenseState || licenseState.loaded !== true) {
            return { resolved: false, canUseMultiple: true };
        }
        const features = Array.isArray(licenseState.features) ? licenseState.features : [];
        return {
            resolved: true,
            canUseMultiple: licenseState.active === true && features.includes('pro'),
        };
    }

    function __tmGetAccessibleCustomBoardSets(setsInput = null) {
        const sets = Array.isArray(setsInput) ? setsInput : __tmGetCustomBoardSets();
        return __tmGetCustomBoardSetLicenseGate().canUseMultiple ? sets.slice() : sets.slice(0, 1);
    }

    function __tmCanAccessCustomBoardSetIndex(index, setsInput = null) {
        const normalizedIndex = Number(index);
        if (!Number.isFinite(normalizedIndex) || normalizedIndex <= 0) return true;
        const sets = Array.isArray(setsInput) ? setsInput : __tmGetCustomBoardSets();
        if (normalizedIndex >= sets.length) return false;
        return __tmGetCustomBoardSetLicenseGate().canUseMultiple;
    }

    async function __tmCanAccessCustomBoardSetIndexAfterLicenseCheck(index, setsInput = null) {
        const sets = Array.isArray(setsInput) ? setsInput : __tmGetCustomBoardSets();
        if (Number(index) <= 0) return true;
        let gate = __tmGetCustomBoardSetLicenseGate();
        if (!gate.resolved) {
            try { await window.tmLicenseLoad?.(); } catch (e) {}
            gate = __tmGetCustomBoardSetLicenseGate();
        }
        return gate.canUseMultiple && Number(index) < sets.length;
    }

    function __tmGetActiveCustomBoardSet() {
        const sets = __tmGetCustomBoardSets();
        const activeId = String(SettingsStore?.data?.activeCustomBoardSetId || '').trim();
        const accessibleSets = __tmGetAccessibleCustomBoardSets(sets);
        return accessibleSets.find((set) => set.id === activeId) || accessibleSets[0] || null;
    }

    function __tmBuildCustomBoardProjectionShell(boardSet = null) {
        const set = boardSet && typeof boardSet === 'object' ? boardSet : __tmGetActiveCustomBoardSet();
        const rules = Array.isArray(state.filterRules) ? state.filterRules : [];
        return (Array.isArray(set?.boards) ? set.boards : []).map((board) => ({
            ...board,
            rule: rules.find((rule) => rule?.enabled !== false
                && String(rule?.id || '').trim() === String(board?.ruleId || '').trim()) || null,
            docIds: [],
            tasks: [],
        }));
    }
    globalThis.__tmBuildCustomBoardProjectionShell = __tmBuildCustomBoardProjectionShell;

    function __tmRenderCustomBoardSetTopbar() {
        const sets = __tmGetAccessibleCustomBoardSets();
        const active = __tmGetActiveCustomBoardSet();
        const options = (sets.length ? sets : [{ id: '', name: __tmT("task.noBoardSets") }]).map((set) => ({
            value: set.id,
            label: set.name,
            selected: !!set.id && set.id === active?.id,
            action: set.id ? `tmSelectCustomBoardSetFromTopbar('${escSq(set.id)}')` : 'tmOpenCustomBoardSetManager()',
        }));
        return `<div class="tm-custom-board-topbar" role="group" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.boardSet")}">
            ${__tmRenderTopbarSelect({
                id: 'tmTopbarCustomBoardSetSelect',
                label: __tmT("task.boardSet"),
                options,
                className: 'tm-custom-board-set-select',
                tooltip: __tmT("task.boardSet"),
            })}
            <button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-custom-board-manage-btn" onclick="tmOpenCustomBoardSetManager()" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.manageCombinationBoards")}" style="padding:0;width:30px;min-width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;"${__tmBuildTooltipAttrs(__tmT("task.manageCombinationBoards"), { side: 'bottom', ariaLabel: false })}>${__tmRenderLucideIcon('settings-2', '', { size: 15 })}</button>
        </div>`;
    }

    function __tmGetCustomBoardRuleName(rule) {
        if (!rule) return __tmT("task.allTasks");
        try { return globalThis.__taskHorizonHostBridge.i18n.builtinName('rule', rule) || rule.name || __tmT("task.untitledRule"); }
        catch (e) { return String(rule.name || __tmT("task.untitledRule")); }
    }

    function __tmCustomBoardScopeLabel(scope) {
        const normalized = __tmNormalizeCustomBoardScope(scope);
        if (normalized.mode === 'all') return __tmT("task.allDocuments");
        if (normalized.mode === 'groups') {
            const names = normalized.groupIds.map((id) => {
                const group = (SettingsStore?.data?.docGroups || []).find((item) => String(item?.id || '').trim() === id);
                return group ? __tmResolveDocGroupName(group) : id;
            });
            return names.join('、') || __tmT("task.noDocumentGroupsSelected");
        }
        if (normalized.mode === 'tabGroup') {
            const group = (SettingsStore?.data?.docTabCustomGroups || []).find((item) => String(item?.id || '').trim() === normalized.tabGroupId);
            return group?.name || __tmT("task.tabGroupNotFound");
        }
        return __tmT("task.selectedDocumentsCount", { count: normalized.docIds.length });
    }

    function __tmRenderCustomBoardSetManager() {
        const sets = __tmGetCustomBoardSets();
        const canUseMultiple = __tmGetCustomBoardSetLicenseGate().canUseMultiple;
        const activeSet = __tmGetActiveCustomBoardSet();
        const activeId = String(activeSet?.id || '').trim();
        const rules = (Array.isArray(state.filterRules) ? state.filterRules : [])
            .filter((rule) => rule && rule.enabled !== false);
        const boardRows = (activeSet?.boards || []).map((board, index) => {
            const rule = rules.find((item) => String(item.id || '').trim() === board.ruleId);
            const ruleLabel = rule ? __tmGetCustomBoardRuleName(rule) : (board.ruleId ? __tmT("task.boardRuleMissing") : __tmGetCustomBoardRuleName(null));
            const groupLabel = __tmGetGroupModeLabel(__tmNormalizeCustomBoardGroupMode(board.groupMode));
            const color = __tmNormalizeHexColor(board.color, '') || 'var(--tm-primary-color)';
            return `<div class="tm-custom-board-manager-row">
                <span class="tm-custom-board-manager-swatch" style="--tm-custom-board-color:${esc(color)};"></span>
                <span class="tm-custom-board-manager-row__main"><strong>${esc(board.name)}</strong><small>${esc(ruleLabel)} · ${esc(groupLabel)} · ${esc(__tmCustomBoardScopeLabel(board.scope))}</small></span>
                <span class="tm-custom-board-manager-row__actions">
                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn" onclick="tmEditCustomBoard('${escSq(board.id)}')" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("common.edit")}"${__tmBuildTooltipAttrs(__tmT("common.edit"), { side: 'top', ariaLabel: false })}>${__tmRenderLucideIcon('square-pen', '', { size: 14 })}</button>
                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn" onclick="tmMoveCustomBoard('${escSq(board.id)}', -1)" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moveUp3")}"${__tmBuildTooltipAttrs(__tmT("settings.moveUp3"), { side: 'top', ariaLabel: false })} ${index === 0 ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-up', '', { size: 14 })}</button>
                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn" onclick="tmMoveCustomBoard('${escSq(board.id)}', 1)" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moveDown3")}"${__tmBuildTooltipAttrs(__tmT("settings.moveDown3"), { side: 'top', ariaLabel: false })} ${index === activeSet.boards.length - 1 ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-down', '', { size: 14 })}</button>
                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn tm-custom-board-manager-icon-btn--danger" onclick="tmDeleteCustomBoard('${escSq(board.id)}')" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.remove")}"${__tmBuildTooltipAttrs(__tmT("task.remove"), { side: 'top', ariaLabel: false })}>${__tmRenderLucideIcon('trash-2', '', { size: 14 })}</button>
                </span>
            </div>`;
        }).join('');
        const setList = sets.map((set, index) => {
            const locked = !canUseMultiple && index > 0;
            const lockLabel = locked ? __tmT("task.combinationBoardExpiredAccessLimited") : '';
            const canMoveSet = canUseMultiple && sets.length > 1;
            const moveUpDisabled = !canMoveSet || index === 0;
            const moveDownDisabled = !canMoveSet || index === sets.length - 1;
            return `
            <div class="tm-custom-board-manager__set-row">
                <button type="button" class="bc-btn bc-btn--ghost tm-custom-board-manager__set-item${set.id === activeId ? ' is-active' : ''}${locked ? ' is-locked' : ''}" onclick="tmSelectCustomBoardSet('${escSq(set.id)}')" aria-pressed="${set.id === activeId ? 'true' : 'false'}"${locked ? ` title="${__tmEscAttr(lockLabel)}" data-tm-custom-board-set-locked="true"` : ''}>
                    <span class="tm-custom-board-manager__set-icon" aria-hidden="true">${__tmRenderLucideIcon(locked ? 'lock' : 'layout-dashboard', '', { size: 16 })}</span>
                    <span class="tm-custom-board-manager__set-copy"><strong>${esc(set.name)}</strong><small>${esc(__tmT("task.subBoardsCount", { count: set.boards.length }))}</small></span>
                    <span class="tm-badge tm-badge--count">${set.boards.length}</span>
                </button>
                <span class="tm-custom-board-manager__set-order" role="group" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.boardSet")}">
                    <button type="button" class="tm-custom-board-manager__set-order-btn" onclick="tmMoveCustomBoardSet('${escSq(set.id)}', -1)" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moveUp3")}" ${moveUpDisabled ? 'disabled' : ''}${__tmBuildTooltipAttrs(__tmT("settings.moveUp3"), { side: 'left', ariaLabel: false })}>${__tmRenderLucideIcon('arrow-up', '', { size: 13 })}</button>
                    <button type="button" class="tm-custom-board-manager__set-order-btn" onclick="tmMoveCustomBoardSet('${escSq(set.id)}', 1)" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moveDown3")}" ${moveDownDisabled ? 'disabled' : ''}${__tmBuildTooltipAttrs(__tmT("settings.moveDown3"), { side: 'left', ariaLabel: false })}>${__tmRenderLucideIcon('arrow-down', '', { size: 13 })}</button>
                </span>
            </div>
        `;
        }).join('');
        return `<div class="tm-prompt-modal tm-custom-board-modal" id="tmCustomBoardManager" role="dialog" aria-modal="true">
            <div class="tm-prompt-box tm-custom-board-manager">
                <div class="tm-custom-board-manager__header">
                    <div>
                        <div class="tm-prompt-title">${__tmT("task.manageCombinationBoards")}</div>
                        <p>${__tmT("task.combinationBoardManagerDescription")}</p>
                    </div>
                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn" onclick="tmCloseCustomBoardDialog()" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("common.close")}">${__tmRenderLucideIcon('x', '', { size: 16 })}</button>
                </div>
                <div class="tm-custom-board-manager__layout">
                    <aside class="tm-custom-board-manager__sets">
                        <div class="tm-custom-board-manager__section-head">
                            <strong>${__tmT("task.boardSet")}</strong>
                            <button type="button" class="bc-btn bc-btn--sm tm-custom-board-manager__create-set" onclick="tmCreateCustomBoardSet()">${__tmRenderLucideIcon('plus', '', { size: 14 })}<span>${__tmT("task.newBoardSet")}</span></button>
                        </div>
                        <div class="tm-custom-board-manager__set-list">${setList || `<p class="tm-custom-board-manager__empty">${__tmT("task.noBoardSets")}</p>`}</div>
                    </aside>
                    <section class="tm-custom-board-manager__detail">
                        ${activeSet ? `
                            <div class="tm-custom-board-manager__detail-head">
                                <label class="tm-custom-board-manager__name"><span>${__tmT("task.boardSetName")}</span><input class="b3-text-field" data-field="name" value="${__tmEscAttr(activeSet.name)}" onblur="tmRenameCustomBoardSet(this.value)" onkeydown="if(event.key==='Enter'){this.blur()}" maxlength="60"></label>
                                <div class="tm-custom-board-manager__danger-row">
                                    <button type="button" class="bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn tm-custom-board-manager-icon-btn--danger" onclick="tmDeleteCustomBoardSet()" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.deleteBoardSet")}"${__tmBuildTooltipAttrs(__tmT("task.deleteBoardSet"), { side: 'top', ariaLabel: false })}>${__tmRenderLucideIcon('trash-2', '', { size: 14 })}<span class="tm-custom-board-manager__delete-set-label">${__tmT("task.deleteBoardSet")}</span></button>
                                </div>
                            </div>
                            <div class="tm-custom-board-manager__subboard-head">
                                <div><strong>${__tmT("task.subBoards")}</strong><small>${__tmT("task.subBoardsCount", { count: activeSet.boards.length })}</small></div>
                                <button type="button" class="bc-btn bc-btn--sm bc-btn--primary" onclick="tmEditCustomBoard('')">${__tmRenderLucideIcon('plus', '', { size: 14 })}<span>${__tmT("task.addSubBoard")}</span></button>
                            </div>
                            <div class="tm-custom-board-manager__list">${boardRows || `<p class="tm-custom-board-manager__empty">${__tmT("task.noSubBoardsYet")}</p>`}</div>
                        ` : `
                            <div class="tm-custom-board-manager__detail-empty">
                                ${__tmRenderLucideIcon('layout-dashboard', '', { size: 28 })}
                                <strong>${__tmT("task.createBoardSetFirst")}</strong>
                                <button type="button" class="bc-btn bc-btn--primary" onclick="tmCreateCustomBoardSet()">${__tmRenderLucideIcon('plus', '', { size: 14 })}<span>${__tmT("task.newBoardSet")}</span></button>
                            </div>
                        `}
                    </section>
                </div>
                <div class="tm-prompt-buttons"><button type="button" class="bc-btn bc-btn--ghost" onclick="tmCloseCustomBoardDialog()">${__tmT("task.closeCombinationBoardManager")}</button></div>
            </div>
        </div>`;
    }

    function __tmShowCustomBoardDialog(html) {
        try { window.tmCloseCustomBoardOptionPicker?.(); } catch (e) {}
        document.querySelectorAll('.tm-custom-board-modal').forEach((item) => {
            try { item.__tmRemoveFromModalStack?.(); } catch (e) {}
            item.remove();
        });
        const host = document.createElement('div');
        host.innerHTML = String(html || '').trim();
        const modal = host.firstElementChild;
        if (!(modal instanceof HTMLElement)) return null;
        document.body.appendChild(modal);
        const box = modal.querySelector('.tm-prompt-box');
        try { __tmApplyPopupOpenAnimation(modal, box); } catch (e) {}
        modal.addEventListener('click', (event) => {
            if (event.target === modal) window.tmCloseCustomBoardDialog();
        });
        try { __tmBindPluginHostGestureIsolation(modal); } catch (e) {}
        const removeFromStack = __tmModalStackBind(() => window.tmCloseCustomBoardDialog());
        modal.__tmRemoveFromModalStack = removeFromStack;
        const firstInput = modal.querySelector('[data-field="name"]');
        const usesTouchInput = (() => {
            try {
                if (__tmIsRuntimeMobileClient() || __tmIsMobileDevice()) return true;
                if (window.matchMedia?.('(pointer: coarse)')?.matches) return true;
            } catch (e) {}
            return false;
        })();
        __tmDecorateCustomBoardSelects(modal, usesTouchInput);
        // Focusing a text field on touch devices opens the software keyboard and
        // can make the following native selects appear unresponsive.
        if (firstInput && !usesTouchInput) {
            try { requestAnimationFrame(() => firstInput.focus({ preventScroll: true })); } catch (e) { try { firstInput.focus(); } catch (e2) {} }
        }
        return modal;
    }

    function __tmSyncCustomBoardNativeSelectTriggers(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : document.getElementById('tmCustomBoardEditor');
        if (!(modal instanceof Element)) return;
        modal.querySelectorAll('[data-tm-custom-board-select-trigger="1"]').forEach((trigger) => {
            const select = trigger.__tmCustomBoardNativeSelect;
            if (!(select instanceof HTMLSelectElement)) return;
            const selected = select.options[select.selectedIndex] || select.options[0] || null;
            const label = trigger.querySelector('[data-tm-custom-board-select-label]');
            if (label) label.textContent = selected?.textContent?.trim() || '';
            trigger.disabled = select.disabled || !select.options.length;
            trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function __tmDecorateCustomBoardSelects(modalEl, interactive) {
        const modal = modalEl instanceof Element ? modalEl : null;
        if (!modal) return;
        const useInteractiveTrigger = interactive === true;
        modal.querySelectorAll('select[data-field]').forEach((select) => {
            if (!(select instanceof HTMLSelectElement) || select.closest('[data-tm-custom-board-select-shell="1"]')) return;
            const shell = document.createElement('span');
            shell.className = 'tm-rule-select-control tm-custom-board-select-control';
            shell.classList.toggle('tm-custom-board-select-control--touch', useInteractiveTrigger);
            shell.dataset.tmCustomBoardSelectShell = '1';
            select.classList.add('bc-select');
            select.parentNode.insertBefore(shell, select);
            shell.appendChild(select);
            if (useInteractiveTrigger) {
                const trigger = document.createElement('button');
                trigger.type = 'button';
                trigger.className = 'bc-select tm-custom-board-select-trigger';
                trigger.dataset.tmCustomBoardSelectTrigger = '1';
                trigger.dataset.tmCustomBoardField = String(select.dataset.field || '');
                trigger.setAttribute('aria-haspopup', 'listbox');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.innerHTML = `<span data-tm-custom-board-select-label></span>`;
                trigger.__tmCustomBoardNativeSelect = select;
                trigger.addEventListener('click', (event) => {
                    try { event.preventDefault(); } catch (e) {}
                    try { event.stopPropagation(); } catch (e) {}
                    trigger.setAttribute('aria-expanded', 'true');
                    window.tmOpenCustomBoardOptionPicker(trigger);
                });
                shell.appendChild(trigger);
            }
            const chevron = document.createElement('span');
            chevron.className = 'tm-custom-board-select-arrow';
            chevron.setAttribute('aria-hidden', 'true');
            shell.appendChild(chevron);
        });
        if (useInteractiveTrigger) __tmSyncCustomBoardNativeSelectTriggers(modal);
    }

    window.tmCloseCustomBoardOptionPicker = function() {
        const picker = document.getElementById('tmCustomBoardOptionPicker');
        try { picker?.__tmRemoveFromModalStack?.(); } catch (e) {}
        picker?.remove();
        if (state.__tmCustomBoardOptionPickerUnstack) {
            try { state.__tmCustomBoardOptionPickerUnstack(); } catch (e) {}
            state.__tmCustomBoardOptionPickerUnstack = null;
        }
        const trigger = state.__tmCustomBoardOptionPickerTrigger;
        if (trigger instanceof Element) trigger.setAttribute('aria-expanded', 'false');
        state.__tmCustomBoardOptionPickerTrigger = null;
    };

    window.tmOpenCustomBoardOptionPicker = function(trigger) {
        const select = trigger?.__tmCustomBoardNativeSelect;
        if (!(select instanceof HTMLSelectElement) || select.disabled || !select.options.length) return;
        window.tmCloseCustomBoardOptionPicker();
        state.__tmCustomBoardOptionPickerTrigger = trigger;
        const fieldLabel = select.closest('.tm-custom-board-field')?.querySelector(':scope > span')?.textContent?.trim()
            || select.getAttribute('aria-label')
            || __tmT("task.select2");
        const selectedValue = select.value;
        const optionsHtml = Array.from(select.options).map((option, index) => `
            <button type="button" class="tm-custom-board-option${option.value === selectedValue ? ' is-selected' : ''}"
                role="option" aria-selected="${option.value === selectedValue ? 'true' : 'false'}"
                data-tm-custom-board-option-index="${index}">
                <span>${esc(option.textContent || '')}</span>
                <span class="tm-custom-board-option-check" aria-hidden="true">${option.value === selectedValue ? '✓' : ''}</span>
            </button>
        `).join('');
        const picker = document.createElement('div');
        picker.id = 'tmCustomBoardOptionPicker';
        picker.className = 'tm-custom-board-option-picker';
        picker.setAttribute('role', 'dialog');
        picker.setAttribute('aria-modal', 'true');
        picker.setAttribute('aria-label', fieldLabel);
        picker.innerHTML = `
            <section class="tm-custom-board-option-sheet">
                <div class="tm-custom-board-option-header">
                    <strong>${esc(fieldLabel)}</strong>
                    <button type="button" class="tm-custom-board-option-close" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("common.close")}">×</button>
                </div>
                <div class="tm-custom-board-option-list" role="listbox">${optionsHtml}</div>
            </section>
        `;
        document.body.appendChild(picker);
        const close = () => window.tmCloseCustomBoardOptionPicker();
        picker.addEventListener('click', (event) => {
            if (event.target === picker) close();
        });
        picker.querySelector('.tm-custom-board-option-close')?.addEventListener('click', close);
        picker.querySelectorAll('[data-tm-custom-board-option-index]').forEach((button) => {
            button.addEventListener('click', (event) => {
                try { event.preventDefault(); } catch (e) {}
                try { event.stopPropagation(); } catch (e) {}
                const option = select.options[Number(button.dataset.tmCustomBoardOptionIndex) || 0];
                if (!option) return;
                select.value = option.value;
                try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                const modal = document.getElementById('tmCustomBoardEditor');
                __tmSyncCustomBoardNativeSelectTriggers(modal);
                try {
                    requestAnimationFrame(() => __tmSyncCustomBoardNativeSelectTriggers(modal));
                } catch (e) {}
                close();
            });
        });
        state.__tmCustomBoardOptionPickerUnstack = __tmModalStackBind(close);
        picker.__tmRemoveFromModalStack = () => {
            try { state.__tmCustomBoardOptionPickerUnstack?.(); } catch (e) {}
            state.__tmCustomBoardOptionPickerUnstack = null;
        };
        try { __tmBindPluginHostGestureIsolation(picker); } catch (e) {}
        try { __tmApplyPopupOpenAnimation(picker, picker.querySelector('.tm-custom-board-option-sheet')); } catch (e) {}
    };

    function __tmGetCustomBoardDocumentOptions() {
        const docs = new Map();
        const push = (doc) => {
            const id = String(doc?.id || '').trim();
            if (!id) return;
            docs.set(id, doc || { id });
        };
        (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach(push);
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach(push);
        (Array.isArray(state.__tmCustomBoardAvailableDocIds) ? state.__tmCustomBoardAvailableDocIds : []).forEach((id) => push({ id }));
        const ids = Array.from(docs.keys());
        return ids.sort((a, b) => {
            const an = __tmGetDocDisplayName(docs.get(a), a);
            const bn = __tmGetDocDisplayName(docs.get(b), b);
            return an.localeCompare(bn, 'zh-Hans-CN');
        }).map((id) => ({ id, name: __tmGetDocDisplayName(docs.get(id), id) }));
    }

    function __tmRenderCustomBoardEditor(boardId = '') {
        const set = __tmGetActiveCustomBoardSet();
        if (!set) return;
        const current = (set.boards || []).find((board) => board.id === String(boardId || '').trim()) || null;
        const board = current || { name: '', ruleId: '', groupMode: 'doc', color: '', scope: { mode: 'all' } };
        const scope = __tmNormalizeCustomBoardScope(board.scope);
        const rules = (Array.isArray(state.filterRules) ? state.filterRules : []).filter((rule) => rule && rule.enabled !== false);
        const ruleOptions = [`<option value="">${__tmT("task.allTasks")}</option>`, ...rules.map((rule) => `<option value="${__tmEscAttr(rule.id)}" ${String(rule.id) === board.ruleId ? 'selected' : ''}>${esc(__tmGetCustomBoardRuleName(rule))}</option>`)].join('');
        const boardGroupMode = __tmNormalizeCustomBoardGroupMode(board.groupMode);
        const boardGroupModeOptions = ['none', 'doc', 'time', 'quadrant', 'task']
            .map((mode) => `<option value="${mode}" ${boardGroupMode === mode ? 'selected' : ''}>${esc(__tmGetGroupModeLabel(mode))}</option>`)
            .join('');
        const groups = (Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : []);
        const groupOptions = [`<option value="all" ${scope.mode === 'tabGroup' && scope.groupId === 'all' ? 'selected' : ''}>${__tmT("task.allDocuments")}</option>`, ...groups.map((group) => `<option value="${__tmEscAttr(group.id)}" ${scope.mode === 'tabGroup' && scope.groupId === String(group.id) ? 'selected' : ''}>${esc(__tmResolveDocGroupName(group))}</option>`)].join('');
        const customTabGroups = Array.isArray(SettingsStore?.data?.docTabCustomGroups) ? SettingsStore.data.docTabCustomGroups : [];
        const tabGroupsForScope = customTabGroups.filter((group) => String(group.docGroupId || 'all') === String(scope.groupId || 'all'));
        const tabGroupOptions = tabGroupsForScope.map((group) => `<option value="${__tmEscAttr(group.id)}" ${scope.mode === 'tabGroup' && scope.tabGroupId === String(group.id) ? 'selected' : ''}>${esc(group.name)}</option>`).join('');
        const groupChecks = groups.map((group) => `<label class="tm-custom-board-check"><input type="checkbox" value="${__tmEscAttr(group.id)}" ${scope.mode === 'groups' && scope.groupIds.includes(String(group.id)) ? 'checked' : ''}><span>${esc(__tmResolveDocGroupName(group))}</span></label>`).join('');
        const selectedDocs = new Set(scope.mode === 'docs' ? scope.docIds : []);
        const docChecks = __tmGetCustomBoardDocumentOptions().map((doc) => `<label class="tm-custom-board-check" data-doc-name="${__tmEscAttr(doc.name.toLocaleLowerCase())}"><input type="checkbox" value="${__tmEscAttr(doc.id)}" ${selectedDocs.has(doc.id) ? 'checked' : ''}><span>${esc(doc.name)}</span></label>`).join('');
        const color = __tmNormalizeHexColor(board.color, '') || '';
        return __tmShowCustomBoardDialog(`<div class="tm-prompt-modal tm-custom-board-modal" id="tmCustomBoardEditor" role="dialog" aria-modal="true" data-board-id="${__tmEscAttr(current?.id || '')}" data-color="${__tmEscAttr(color)}">
            <div class="tm-prompt-box tm-custom-board-editor">
                <div class="tm-prompt-title">${current ? __tmT("task.editSubBoard") : __tmT("task.addSubBoard")}</div>
                <label class="tm-custom-board-field"><span>${__tmT("task.subBoardName")}</span><input class="b3-text-field" data-field="name" value="${__tmEscAttr(board.name)}" maxlength="60" required></label>
                <label class="tm-custom-board-field"><span>${__tmT("task.filterRule")}</span><select class="b3-select" data-field="ruleId">${ruleOptions}</select></label>
                <label class="tm-custom-board-field"><span>${__tmT("task.subBoardGrouping")}</span><select class="b3-select" data-field="groupMode">${boardGroupModeOptions}</select></label>
                <div class="tm-custom-board-field"><span>${__tmT("task.taskSource")}</span><select class="b3-select" data-field="scopeMode" onchange="tmCustomBoardScopeModeChanged(this.value)">
                    <option value="all" ${scope.mode === 'all' ? 'selected' : ''}>${__tmT("task.allDocuments")}</option>
                    <option value="groups" ${scope.mode === 'groups' ? 'selected' : ''}>${__tmT("task.documentGroups")}</option>
                    <option value="tabGroup" ${scope.mode === 'tabGroup' ? 'selected' : ''}>${__tmT("task.tabGroup")}</option>
                    <option value="docs" ${scope.mode === 'docs' ? 'selected' : ''}>${__tmT("task.selectedDocuments")}</option>
                </select></div>
                <div class="tm-custom-board-scope" data-scope-mode="groups" ${scope.mode !== 'groups' ? 'hidden' : ''}>${groupChecks || `<p class="tm-custom-board-manager__empty">${__tmT("task.noDocumentGroups")}</p>`}</div>
                <div class="tm-custom-board-scope tm-custom-board-scope--tab-group" data-scope-mode="tabGroup" ${scope.mode !== 'tabGroup' ? 'hidden' : ''}>
                    <select class="b3-select" data-field="groupId" onchange="tmCustomBoardTabGroupGroupChanged(this.value)">${groupOptions}</select>
                    <select class="b3-select" data-field="tabGroupId">${tabGroupOptions || `<option value="">${__tmT("task.noTabGroupsInSelectedGroup")}</option>`}</select>
                </div>
                <div class="tm-custom-board-scope tm-custom-board-scope--docs" data-scope-mode="docs" ${scope.mode !== 'docs' ? 'hidden' : ''}>
                    <input class="b3-text-field" data-field="docSearch" placeholder="${__tmEscAttr(__tmT("task.searchDocuments"))}" oninput="tmFilterCustomBoardDocumentOptions(this.value)">
                    <div class="tm-custom-board-document-list">${docChecks || `<p class="tm-custom-board-manager__empty">${__tmT("task.noDocumentsAvailable")}</p>`}</div>
                </div>
                <div class="tm-custom-board-color-row"><span>${__tmT("task.subBoardColor")}</span><button type="button" class="tm-custom-board-color" style="--tm-custom-board-color:${esc(color || 'var(--tm-primary-color)')};" onclick="tmPickCustomBoardColor()" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.subBoardColor")}"${__tmBuildTooltipAttrs(__tmT("task.subBoardColor"), { side: 'top', ariaLabel: false })}></button><span class="tm-custom-board-color-value">${esc(color || __tmT("task.defaultColor"))}</span></div>
                <div class="tm-prompt-buttons"><button type="button" class="tm-prompt-btn tm-prompt-btn-secondary" onclick="tmCloseCustomBoardDialog()">${__tmT("common.cancel")}</button><button type="button" class="tm-prompt-btn tm-prompt-btn-primary" onclick="tmSaveCustomBoard()">${__tmT("common.save")}</button></div>
            </div>
        </div>`);
    }

    function __tmCloneCustomBoardDocIdsByBoard(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        return Object.fromEntries(Object.entries(source).map(([boardId, ids]) => [
            String(boardId || '').trim(),
            __tmNormalizeDocScopeDocIds(ids || []),
        ]).filter(([boardId, ids]) => !!boardId && ids.length > 0));
    }

    function __tmBuildCustomBoardProjectionCacheSignature(set = null) {
        const boardSet = set && typeof set === 'object' ? set : __tmGetActiveCustomBoardSet();
        const boards = Array.isArray(boardSet?.boards) ? boardSet.boards : [];
        const ruleIds = new Set(boards.map((board) => String(board?.ruleId || '').trim()).filter(Boolean));
        const rules = (Array.isArray(state.filterRules) ? state.filterRules : [])
            .filter((rule) => ruleIds.has(String(rule?.id || '').trim()));
        const dateFilter = globalThis.__tmDateFilter;
        const docGroups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        const tabGroups = Array.isArray(SettingsStore?.data?.docTabCustomGroups) ? SettingsStore.data.docTabCustomGroups : [];
        try {
            return JSON.stringify({
                boardSet,
                rules,
                day: typeof __tmGetTodayDateKey === 'function' ? __tmGetTodayDateKey() : '',
                searchFields: typeof __tmGetTaskSearchFields === 'function' ? __tmGetTaskSearchFields() : [],
                searchKeyword: String(state.searchKeyword || '').trim(),
                showCompletedTasks: state.showCompletedTasks === true,
                completedTasksTodayOnly: SettingsStore?.data?.completedTasksTodayOnly === true,
                completedTasksInlineInGroups: SettingsStore?.data?.completedTasksInlineInGroups === true,
                hideInboxFromAllTab: SettingsStore?.data?.hideInboxFromAllTab === true,
                projectVisibilityRevision: Number(globalThis.__tmProjectVisibility?.getRevision?.() || 0) || 0,
                dateFilter: String(dateFilter?.signature?.() || ''),
                docGroupSettingsUpdatedAt: Number(SettingsStore?.data?.docGroupSettingsUpdatedAt || 0) || 0,
                docGroups,
                tabGroups,
                recursiveDocLimit: Number(SettingsStore?.data?.recursiveDocLimit || 0) || 0,
                customFieldDefsVersion: Number(SettingsStore?.data?.customFieldDefsVersion || 0) || 0,
            });
        } catch (e) {
            return '';
        }
    }

    function __tmRememberCurrentCustomBoardProjectionCache(set = null) {
        if (state.__tmCustomBoardLoading === true) return false;
        const boardSet = set && typeof set === 'object' ? set : __tmGetActiveCustomBoardSet();
        const setId = String(boardSet?.id || '').trim();
        const columns = Array.isArray(state.customBoardProjection) ? state.customBoardProjection : null;
        const sourceDocIdsByBoard = __tmCloneCustomBoardDocIdsByBoard(state.__tmCustomBoardSourceDocIdsByBoard);
        const sourceDocIds = __tmGetCachedCustomBoardSourceDocIds({ sourceDocIdsByBoard });
        const signature = __tmBuildCustomBoardProjectionCacheSignature(boardSet);
        if (!setId || !columns || !signature) return false;
        if (Array.isArray(boardSet?.boards) && boardSet.boards.length > 0 && sourceDocIds.length === 0) return false;
        const previous = __tmCustomBoardProjectionCache.get(setId);
        const fingerprints = previous?.taskDataReadToken
            && globalThis.__tmTaskStore?.isReadCurrent?.(previous.taskDataReadToken) === true
            ? previous.docFingerprints
            : __tmBuildCustomBoardDocumentFingerprints(sourceDocIds);
        __tmCustomBoardProjectionCache.delete(setId);
        __tmCustomBoardProjectionCache.set(setId, {
            setId,
            signature,
            sourceDocIdsByBoard,
            columns: columns.map((column) => ({
                ...column,
                docIds: Array.isArray(column?.docIds) ? column.docIds.slice() : [],
                tasks: Array.isArray(column?.tasks) ? column.tasks.slice() : [],
            })),
            allVisible: Array.isArray(state.filteredTasks) ? state.filteredTasks.slice() : [],
            taskDataReadToken: globalThis.__tmTaskStore?.captureRead?.(sourceDocIds) || null,
            docFingerprints: fingerprints,
            cachedAt: Date.now(),
        });
        while (__tmCustomBoardProjectionCache.size > __TM_CUSTOM_BOARD_PROJECTION_CACHE_LIMIT) {
            __tmCustomBoardProjectionCache.delete(__tmCustomBoardProjectionCache.keys().next().value);
        }
        return true;
    }

    function __tmBuildCustomBoardDocumentFingerprints(docIds) {
        if (typeof __tmBuildTaskProjectionDataSignature !== 'function') return {};
        const tasksByDoc = new Map(docIds.map((id) => [id, []]));
        Object.values(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}).forEach((task) => {
            tasksByDoc.get(String(task?.root_id || task?.docId || '').trim())?.push(task);
        });
        return Object.fromEntries(Array.from(tasksByDoc, ([id, tasks]) => [id, __tmBuildTaskProjectionDataSignature(tasks)]));
    }

    function __tmGetCachedCustomBoardSourceDocIds(entry = null) {
        const source = entry?.sourceDocIdsByBoard && typeof entry.sourceDocIdsByBoard === 'object'
            ? entry.sourceDocIdsByBoard
            : {};
        return Array.from(new Set(Object.values(source)
            .flatMap((ids) => Array.isArray(ids) ? ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
    }

    function __tmGetMissingCachedCustomBoardTaskDocIds(entry = null) {
        const requiredIds = __tmGetCachedCustomBoardSourceDocIds(entry);
        if (!requiredIds.length) return [];
        // A loaded document without tasks has no task-tree entry and no tasks in
        // the store, so only "not loaded" can mean its tasks are missing. Treating
        // it as missing made every cache refresh re-read all task-less documents.
        const loadedIds = new Set((Array.isArray(state.__tmLoadedDocIdsForTasks) ? state.__tmLoadedDocIdsForTasks : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        return requiredIds.filter((id) => !loadedIds.has(id));
    }

    function __tmIsCachedCustomBoardTaskDataCurrent(entry = null) {
        return __tmGetMissingCachedCustomBoardTaskDocIds(entry).length === 0;
    }

    function __tmGetChangedCachedCustomBoardDocIds(entry = null) {
        const taskStore = globalThis.__tmTaskStore;
        const cachedToken = entry?.taskDataReadToken;
        if (!cachedToken || typeof taskStore?.captureRead !== 'function') return [];
        const requiredIds = __tmGetCachedCustomBoardSourceDocIds(entry);
        if (!requiredIds.length) return [];
        const currentToken = taskStore.captureRead(requiredIds);
        if (!currentToken || typeof currentToken !== 'object') return requiredIds;
        const unscopedChanged = Number(currentToken.unscopedRevision || 0) !== Number(cachedToken.unscopedRevision || 0);
        const cachedRevisions = cachedToken.docRevisions && typeof cachedToken.docRevisions === 'object'
            ? cachedToken.docRevisions
            : {};
        const currentRevisions = currentToken.docRevisions && typeof currentToken.docRevisions === 'object'
            ? currentToken.docRevisions
            : {};
        const changed = unscopedChanged ? requiredIds
            : requiredIds.filter((id) => Number(cachedRevisions[id] || 0) !== Number(currentRevisions[id] || 0));
        const fingerprints = __tmBuildCustomBoardDocumentFingerprints(changed);
        return changed.filter((id) => !entry?.docFingerprints?.[id]
            || !fingerprints[id] || entry.docFingerprints[id] !== fingerprints[id]);
    }

    function __tmTryRestoreCachedCustomBoardProjection(set = null) {
        const boardSet = set && typeof set === 'object' ? set : __tmGetActiveCustomBoardSet();
        const setId = String(boardSet?.id || '').trim();
        const cached = setId ? __tmCustomBoardProjectionCache.get(setId) : null;
        if (!cached || cached.signature !== __tmBuildCustomBoardProjectionCacheSignature(boardSet)) {
            if (setId) __tmCustomBoardProjectionCache.delete(setId);
            return false;
        }
        if (__tmGetMissingCachedCustomBoardTaskDocIds(cached).length
            && typeof __tmRestoreDocSessionTaskState === 'function') {
            __tmRestoreDocSessionTaskState({
                docIds: __tmGetCachedCustomBoardSourceDocIds(cached),
                groupId: String(SettingsStore.data.currentGroupId || 'all'),
                docUpdatedMap: typeof __tmBuildDocUpdatedFingerprintMap === 'function'
                    ? __tmBuildDocUpdatedFingerprintMap(state.allDocuments) : null,
            });
        }
        const columns = cached.columns.map((column) => ({
            ...column,
            docIds: Array.isArray(column?.docIds) ? column.docIds.slice() : [],
            tasks: Array.isArray(column?.tasks) ? column.tasks.slice() : [],
        }));
        state.__tmCustomBoardSourceDocIdsByBoard = __tmCloneCustomBoardDocIdsByBoard(cached.sourceDocIdsByBoard);
        state.customBoardProjection = columns;
        state.filteredTasks = Array.isArray(cached.allVisible) ? cached.allVisible.slice() : [];
        state.filteredDocIdsForTabs = [];
        state.__tmCustomBoardLoading = false;
        state.__tmCustomBoardLoadingToken = 0;
        __tmUpdateFilteredTaskRenderWindowState(state.filteredTasks);
        const dateFilter = globalThis.__tmDateFilter;
        if (dateFilter?.active?.()) {
            try { dateFilter.setCandidates(state.filteredTasks); } catch (e) {}
        }
        const fresh = __tmGetChangedCachedCustomBoardDocIds(cached).length === 0
            && __tmIsCachedCustomBoardTaskDataCurrent(cached);
        if (fresh) cached.taskDataReadToken = globalThis.__tmTaskStore?.captureRead?.(__tmGetCachedCustomBoardSourceDocIds(cached)) || null;
        else __tmScheduleCustomBoardProjectionRefresh(setId);
        return true;
    }

    function __tmScheduleCustomBoardProjectionRefresh(setId = '') {
        const targetId = String(setId || '').trim();
        if (!targetId) return false;
        try { if (__tmCustomBoardProjectionRefreshTimer) clearTimeout(__tmCustomBoardProjectionRefreshTimer); } catch (e) {}
        __tmCustomBoardProjectionRefreshTimer = setTimeout(async () => {
            __tmCustomBoardProjectionRefreshTimer = 0;
            if (String(state.viewMode || '').trim() !== __TM_CUSTOM_BOARD_VIEW_MODE) return;
            if (String(__tmGetActiveCustomBoardSet()?.id || '').trim() !== targetId) return;
            const token = Number(state.openToken) || 0;
            const isTokenCurrent = () => globalThis.__tmRuntimeState?.isCurrentOpenToken?.(token)
                ?? (token === (Number(state.openToken) || 0));
            const cached = __tmCustomBoardProjectionCache.get(targetId);
            if (!cached) return;
            const changedDocIds = __tmGetChangedCachedCustomBoardDocIds(cached);
            const missingDocIds = __tmGetMissingCachedCustomBoardTaskDocIds(cached);
            const refreshDocIds = Array.from(new Set([...changedDocIds, ...missingDocIds]));
            let refreshed = refreshDocIds.length === 0;
            if (!refreshed && typeof __tmRefreshAffectedDocsIncrementally === 'function') {
                try {
                    refreshed = true;
                    for (let offset = 0; offset < refreshDocIds.length; offset += 12) {
                        if (!isTokenCurrent() || String(state.viewMode || '').trim() !== __TM_CUSTOM_BOARD_VIEW_MODE
                            || String(__tmGetActiveCustomBoardSet()?.id || '').trim() !== targetId) return;
                        refreshed = await __tmRefreshAffectedDocsIncrementally({
                            docIds: refreshDocIds.slice(offset, offset + 12),
                            allowUnloadedDocIds: true,
                            commitView: false,
                            refreshView: false,
                            persistCaches: true,
                            deferIfDetailBusy: false,
                            reason: 'custom-board-cache-refresh',
                            isCurrent: () => isTokenCurrent()
                                && String(state.viewMode || '').trim() === __TM_CUSTOM_BOARD_VIEW_MODE
                                && String(__tmGetActiveCustomBoardSet()?.id || '').trim() === targetId,
                        });
                        if (!refreshed) break;
                        if (offset + 12 < refreshDocIds.length) await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                } catch (e) {
                    refreshed = false;
                }
            }
            if (!refreshed) {
                try {
                    const loaded = await loadSelectedDocuments({
                        source: 'custom-board-cache-refresh',
                        skipRender: true,
                        showInlineLoading: false,
                        preferFastFirstPaint: false,
                        skipFullLoadAfterFastFirstPaint: true,
                        retryEmptyDocScope: true,
                    });
                    refreshed = loaded !== false;
                } catch (e) {
                    refreshed = false;
                }
            }
            if (refreshed
                && isTokenCurrent()
                && String(state.viewMode || '').trim() === __TM_CUSTOM_BOARD_VIEW_MODE
                && String(__tmGetActiveCustomBoardSet()?.id || '').trim() === targetId) {
                __tmBuildCustomBoardProjection();
                __tmRememberCurrentCustomBoardProjectionCache();
                try { render(); } catch (e) {}
            }
        }, 220);
        return true;
    }

    async function __tmReloadCustomBoardTasks() {
        if (String(state.viewMode || '') !== __TM_CUSTOM_BOARD_VIEW_MODE) {
            try { render(); } catch (e) {}
            return;
        }
        if (__tmTryRestoreCachedCustomBoardProjection()) {
            try { render(); } catch (e) {}
            return true;
        }
        state.__tmCustomBoardLoading = true;
        state.__tmCustomBoardLoadingToken = Number(state.openToken) || 0;
        state.customBoardProjection = __tmBuildCustomBoardProjectionShell();
        state.filteredTasks = [];
        state.filteredDocIdsForTabs = [];
        state.__tmCustomBoardSourceDocIdsByBoard = null;
        try { render(); } catch (e) {}
        try {
            await loadSelectedDocuments({
                source: 'custom-board-change',
                preferFastFirstPaint: true,
                retryEmptyDocScope: true,
            });
        } catch (e) {
            try { hint(String(e?.message || e), 'warning'); } catch (e2) {}
        }
        __tmRememberCurrentCustomBoardProjectionCache();
        try { render(); } catch (e) {}
        return true;
    }

    window.tmOpenCustomBoardSetManager = function() {
        __tmShowCustomBoardDialog(__tmRenderCustomBoardSetManager());
    };

    function __tmRefreshCustomBoardSetManagerInPlace() {
        const modal = document.getElementById('tmCustomBoardManager');
        const currentBox = modal?.querySelector?.('.tm-custom-board-manager');
        if (!(modal instanceof HTMLElement) || !(currentBox instanceof HTMLElement)) {
            window.tmOpenCustomBoardSetManager();
            return false;
        }
        const host = document.createElement('div');
        host.innerHTML = __tmRenderCustomBoardSetManager();
        const nextBox = host.firstElementChild?.querySelector?.('.tm-custom-board-manager');
        if (!(nextBox instanceof HTMLElement)) return false;
        currentBox.replaceWith(nextBox);
        return true;
    }

    window.tmCloseCustomBoardDialog = function() {
        try { window.tmCloseCustomBoardOptionPicker?.(); } catch (e) {}
        const modal = document.querySelector('.tm-custom-board-modal');
        try { modal?.__tmRemoveFromModalStack?.(); } catch (e) {}
        modal?.remove();
    };

    window.tmCreateCustomBoardSet = async function() {
        let sets = __tmGetCustomBoardSets();
        if (sets.length >= 1) {
            sets = __tmGetCustomBoardSets();
            if (!(await __tmCanCreateAdditionalCustomBoardSetAfterLicenseCheck(sets))) {
                try {
                    window.tmRequireFullFeature?.('pro', __tmT("task.additionalCombinationBoardSets"), {
                        onViewBenefits: () => window.tmCloseCustomBoardDialog(),
                    });
                } catch (e) {}
                return false;
            }
        }
        const id = __tmCreateCustomBoardId('set');
        sets.push({ id, name: `${__tmT("task.newBoardSet")} ${sets.length + 1}`, boards: [] });
        SettingsStore.data.customBoardSets = sets;
        SettingsStore.data.activeCustomBoardSetId = id;
        await SettingsStore.save();
        __tmRefreshCustomBoardSetManagerInPlace();
        await __tmReloadCustomBoardTasks();
        return true;
    };

    window.tmRenameCustomBoardSet = async function(value) {
        const set = __tmGetActiveCustomBoardSet();
        const name = String(value || '').trim();
        if (!set || !name || set.name === name) return;
        set.name = name.slice(0, 60);
        SettingsStore.data.customBoardSets = __tmGetCustomBoardSets();
        await SettingsStore.save();
        __tmRefreshCustomBoardSetManagerInPlace();
        try { render(); } catch (e) {}
    };

    window.tmMoveCustomBoardSet = async function(setId, delta) {
        const sets = __tmGetCustomBoardSets();
        if (sets.length <= 1) return false;
        const index = sets.findIndex((set) => String(set?.id || '').trim() === String(setId || '').trim());
        const nextIndex = index + Math.sign(Number(delta) || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= sets.length) return false;
        if (!(await __tmCanAccessCustomBoardSetIndexAfterLicenseCheck(1, sets))) {
            __tmPromptCustomBoardSetAccessRestriction();
            return false;
        }
        [sets[index], sets[nextIndex]] = [sets[nextIndex], sets[index]];
        SettingsStore.data.customBoardSets = sets;
        __tmRefreshCustomBoardSetManagerInPlace();
        try { render(); } catch (e) {}
        await SettingsStore.save();
        return true;
    };

    function __tmPromptCustomBoardSetAccessRestriction() {
        try {
            window.tmRequireFullFeature?.('pro', __tmT("task.additionalCombinationBoardSets"), {
                onViewBenefits: () => window.tmCloseCustomBoardDialog(),
            });
        } catch (e) {}
    }

    window.tmSelectCustomBoardSet = async function(id) {
        const nextId = String(id || '').trim();
        const sets = __tmGetCustomBoardSets();
        const nextIndex = sets.findIndex((set) => set.id === nextId);
        const nextSet = nextIndex >= 0 ? sets[nextIndex] : null;
        if (!nextSet) return;
        if (!(await __tmCanAccessCustomBoardSetIndexAfterLicenseCheck(nextIndex, sets))) {
            __tmPromptCustomBoardSetAccessRestriction();
            return false;
        }
        SettingsStore.data.activeCustomBoardSetId = nextId;
        try { void __tmShortcuts?.persistSession?.(); } catch (e) {}
        const savePromise = SettingsStore.save();
        __tmRefreshCustomBoardSetManagerInPlace();
        try { await __tmReloadCustomBoardTasks(); } finally { await savePromise; }
        return true;
    };

    window.tmDeleteCustomBoardSet = async function() {
        const active = __tmGetActiveCustomBoardSet();
        if (!active) return;
        const ok = await showConfirm(__tmT("task.deleteBoardSet"), __tmT("task.deleteBoardSetConfirm", { name: active.name }));
        if (!ok) { __tmRefreshCustomBoardSetManagerInPlace(); return; }
        const sets = __tmGetCustomBoardSets().filter((set) => set.id !== active.id);
        SettingsStore.data.customBoardSets = sets;
        SettingsStore.data.activeCustomBoardSetId = sets[0]?.id || '';
        await SettingsStore.save();
        __tmRefreshCustomBoardSetManagerInPlace();
        await __tmReloadCustomBoardTasks();
    };

    window.tmEditCustomBoard = async function(boardId) {
        try {
            state.__tmCustomBoardAvailableDocIds = await resolveDocIdsFromGroups({ groupId: 'all', includeQuickAddDoc: false, completeScope: true });
        } catch (e) {
            state.__tmCustomBoardAvailableDocIds = [];
        }
        __tmRenderCustomBoardEditor(boardId);
    };

    window.tmSaveCustomBoard = async function() {
        const modal = document.getElementById('tmCustomBoardEditor');
        const set = __tmGetActiveCustomBoardSet();
        if (!modal || !set) return;
        const name = String(modal.querySelector('[data-field="name"]')?.value || '').trim();
        if (!name) {
            modal.querySelector('[data-field="name"]')?.focus();
            return;
        }
        const mode = String(modal.querySelector('[data-field="scopeMode"]')?.value || 'all');
        let scope = { mode: 'all' };
        if (mode === 'groups') scope = { mode, groupIds: Array.from(modal.querySelectorAll('[data-scope-mode="groups"] input:checked')).map((input) => input.value) };
        if (mode === 'tabGroup') scope = { mode, groupId: modal.querySelector('[data-field="groupId"]')?.value || 'all', tabGroupId: modal.querySelector('[data-field="tabGroupId"]')?.value || '' };
        if (mode === 'docs') scope = { mode, docIds: Array.from(modal.querySelectorAll('.tm-custom-board-document-list input:checked')).map((input) => input.value) };
        const id = String(modal.dataset.boardId || '').trim() || __tmCreateCustomBoardId();
        const next = {
            id,
            name: name.slice(0, 60),
            ruleId: String(modal.querySelector('[data-field="ruleId"]')?.value || '').trim(),
            groupMode: __tmNormalizeCustomBoardGroupMode(modal.querySelector('[data-field="groupMode"]')?.value),
            color: __tmNormalizeHexColor(modal.dataset.color, '') || '',
            scope: __tmNormalizeCustomBoardScope(scope),
        };
        const index = set.boards.findIndex((board) => board.id === id);
        if (index >= 0) set.boards[index] = next;
        else set.boards.push(next);
        SettingsStore.data.customBoardSets = __tmGetCustomBoardSets();
        await SettingsStore.save();
        window.tmOpenCustomBoardSetManager();
        await __tmReloadCustomBoardTasks();
    };

    window.tmMoveCustomBoard = async function(boardId, delta) {
        const set = __tmGetActiveCustomBoardSet();
        if (!set) return;
        const index = set.boards.findIndex((board) => board.id === String(boardId || '').trim());
        const nextIndex = index + Math.sign(Number(delta) || 0);
        if (index < 0 || nextIndex < 0 || nextIndex >= set.boards.length) return;
        [set.boards[index], set.boards[nextIndex]] = [set.boards[nextIndex], set.boards[index]];
        SettingsStore.data.customBoardSets = __tmGetCustomBoardSets();
        await SettingsStore.save();
        __tmRefreshCustomBoardSetManagerInPlace();
        await __tmReloadCustomBoardTasks();
    };

    window.tmDeleteCustomBoard = async function(boardId) {
        const set = __tmGetActiveCustomBoardSet();
        if (!set) return;
        const board = set.boards.find((item) => item.id === String(boardId || '').trim());
        if (!board) return;
        const ok = await showConfirm(__tmT("task.deleteSubBoard"), __tmT("task.deleteSubBoardConfirm", { name: board.name }));
        if (!ok) return;
        // Delete only the sub-board column definition. The referenced filter rule,
        // document groups, tasks, and the normal task-loading rules stay intact.
        const setId = String(set.id || '').trim();
        SettingsStore.data.customBoardSets = __tmGetCustomBoardSets().map((item) => (
            item.id === setId
                ? { ...item, boards: item.boards.filter((candidate) => candidate.id !== board.id) }
                : item
        ));
        __tmRefreshCustomBoardSetManagerInPlace();
        await SettingsStore.save();
        await __tmReloadCustomBoardTasks();
    };

    window.tmCustomBoardScopeModeChanged = function(mode) {
        const modal = document.getElementById('tmCustomBoardEditor');
        if (!modal) return;
        modal.querySelectorAll('[data-scope-mode]').forEach((element) => { element.hidden = element.dataset.scopeMode !== mode; });
    };

    window.tmCustomBoardTabGroupGroupChanged = function(groupId) {
        const modal = document.getElementById('tmCustomBoardEditor');
        if (!modal) return;
        const groups = (Array.isArray(SettingsStore?.data?.docTabCustomGroups) ? SettingsStore.data.docTabCustomGroups : [])
            .filter((group) => String(group.docGroupId || 'all') === String(groupId || 'all'));
        const select = modal.querySelector('[data-field="tabGroupId"]');
        if (!select) return;
        select.innerHTML = groups.map((group) => `<option value="${__tmEscAttr(group.id)}">${esc(group.name)}</option>`).join('') || `<option value="">${__tmT("task.noTabGroupsInSelectedGroup")}</option>`;
    };

    window.tmFilterCustomBoardDocumentOptions = function(value) {
        const query = String(value || '').trim().toLocaleLowerCase();
        document.querySelectorAll('#tmCustomBoardEditor .tm-custom-board-document-list [data-doc-name]').forEach((row) => {
            row.hidden = !!query && !String(row.dataset.docName || '').includes(query);
        });
    };

    window.tmPickCustomBoardColor = function() {
        const modal = document.getElementById('tmCustomBoardEditor');
        if (!modal) return;
        const initial = __tmNormalizeHexColor(modal.dataset.color, '#3b82f6') || '#3b82f6';
        __tmOpenColorPickerDialog(__tmT("task.subBoardColor"), initial, (color) => {
            const normalized = __tmNormalizeHexColor(color, '');
            if (!normalized) return;
            modal.dataset.color = normalized;
            const swatch = modal.querySelector('.tm-custom-board-color');
            const value = modal.querySelector('.tm-custom-board-color-value');
            if (swatch) swatch.style.setProperty('--tm-custom-board-color', normalized);
            if (value) value.textContent = normalized;
        }, __tmBuildPresetColorPickerOptions(initial));
    };

    window.tmSelectCustomBoardSetFromTopbar = async function(id) {
        const nextId = String(id || '').trim();
        const sets = __tmGetCustomBoardSets();
        const nextIndex = sets.findIndex((set) => set.id === nextId);
        const nextSet = nextIndex >= 0 ? sets[nextIndex] : null;
        if (!nextSet) return;
        if (!(await __tmCanAccessCustomBoardSetIndexAfterLicenseCheck(nextIndex, sets))) {
            __tmPromptCustomBoardSetAccessRestriction();
            return false;
        }
        SettingsStore.data.activeCustomBoardSetId = nextId;
        try { void __tmShortcuts?.persistSession?.(); } catch (e) {}
        const savePromise = SettingsStore.save();
        try { await __tmReloadCustomBoardTasks(); } finally { await savePromise; }
        return true;
    };

    function __tmEnforceCustomBoardSetAccess() {
        const active = __tmGetActiveCustomBoardSet();
        const previousId = String(SettingsStore?.data?.activeCustomBoardSetId || '').trim();
        if (!active) return false;
        const changed = previousId !== active.id;
        if (changed) SettingsStore.data.activeCustomBoardSetId = active.id;
        if (document.querySelector('.tm-custom-board-modal')) {
            try { __tmRefreshCustomBoardSetManagerInPlace(); } catch (e) {}
        }
        if (changed) {
            try { hint(__tmT("task.combinationBoardExpiredAccessLimited"), 'warning'); } catch (e) {}
        }
        if (String(state.viewMode || '').trim() === __TM_CUSTOM_BOARD_VIEW_MODE) {
            void __tmReloadCustomBoardTasks();
        }
        return changed;
    }
    globalThis.__tmEnforceCustomBoardSetAccess = __tmEnforceCustomBoardSetAccess;

    if (globalThis.__tmCustomBoardLicenseAccessBound !== true) {
        globalThis.__tmCustomBoardLicenseAccessBound = true;
        const handler = () => {
            try { __tmEnforceCustomBoardSetAccess(); } catch (e) {}
        };
        try {
            if (globalThis.__tmRuntimeEvents?.on) globalThis.__tmRuntimeEvents.on(window, 'tm:task-horizon-license-changed', handler);
            else window.addEventListener('tm:task-horizon-license-changed', handler);
        } catch (e) {}
    }

    function __tmBuildCustomBoardScopeCacheKey(boardSet = null) {
        const set = boardSet && typeof boardSet === 'object' ? boardSet : __tmGetActiveCustomBoardSet();
        if (!set?.id) return '';
        const boards = (Array.isArray(set.boards) ? set.boards : []).map((board) => ({
            id: String(board?.id || '').trim(),
            scope: __tmNormalizeCustomBoardScope(board?.scope),
        }));
        const relevantGroupIds = new Set();
        const relevantTabGroupIds = new Set();
        boards.forEach((board) => {
            if (board.scope.mode === 'groups') board.scope.groupIds.forEach((id) => relevantGroupIds.add(id));
            if (board.scope.mode === 'tabGroup') {
                relevantGroupIds.add(board.scope.groupId);
                if (board.scope.tabGroupId) relevantTabGroupIds.add(board.scope.tabGroupId);
            }
            if (board.scope.mode === 'all') relevantGroupIds.add('all');
        });
        const groups = (Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [])
            .filter((group) => relevantGroupIds.has(String(group?.id || '').trim()));
        const tabGroups = (Array.isArray(SettingsStore?.data?.docTabCustomGroups) ? SettingsStore.data.docTabCustomGroups : [])
            .filter((group) => relevantTabGroupIds.has(String(group?.id || '').trim()));
        let signature = '';
        try {
            signature = JSON.stringify({
                set: String(set.id || '').trim(),
                boards,
                groups,
                tabGroups,
                recursiveDocLimit: Number(SettingsStore?.data?.recursiveDocLimit) || 0,
            });
        } catch (e) {
            signature = JSON.stringify({ set: set.id, boards });
        }
        const hash = typeof __tmHash32 === 'function'
            ? __tmHash32(signature).toString(16)
            : String(signature.length);
        return `custom-board-set-scope-v1|${set.id}|${boards.length}|${signature.length}|${hash}`;
    }

    function __tmNormalizeCachedCustomBoardDocIds(rawBoardDocIds, boards = []) {
        if (!(rawBoardDocIds && typeof rawBoardDocIds === 'object' && !Array.isArray(rawBoardDocIds))) return null;
        const boardIds = new Set((Array.isArray(boards) ? boards : []).map((board) => String(board?.id || '').trim()).filter(Boolean));
        if (!boardIds.size) return null;
        const normalized = {};
        let hasDocIds = false;
        for (const boardId of boardIds) {
            const ids = Array.isArray(rawBoardDocIds[boardId]) ? rawBoardDocIds[boardId] : [];
            normalized[boardId] = __tmNormalizeDocScopeDocIds(ids);
            if (normalized[boardId].length > 0) hasDocIds = true;
        }
        return hasDocIds ? normalized : null;
    }

    function __tmCustomBoardScopeMapsMatch(left, right) {
        const leftBoardDocIds = left?.boardDocIds || {};
        const rightBoardDocIds = right?.boardDocIds || {};
        const boardIds = new Set([...Object.keys(leftBoardDocIds), ...Object.keys(rightBoardDocIds)]);
        for (const boardId of boardIds) {
            const leftIds = Array.isArray(leftBoardDocIds[boardId]) ? leftBoardDocIds[boardId] : [];
            const rightIds = Array.isArray(rightBoardDocIds[boardId]) ? rightBoardDocIds[boardId] : [];
            if (leftIds.join('\n') !== rightIds.join('\n')) return false;
        }
        return (left?.docIds || []).join('\n') === (right?.docIds || []).join('\n');
    }

    function __tmRememberCustomBoardSetDocumentScopes(cacheKey, resolved, options = {}) {
        const key = String(cacheKey || '').trim();
        const boardDocIds = resolved?.boardDocIds && typeof resolved.boardDocIds === 'object' ? resolved.boardDocIds : {};
        const docIds = __tmNormalizeDocScopeDocIds(resolved?.docIds || []);
        if (!key || !docIds.length) return resolved;
        const entry = {
            cacheKey: key,
            boardDocIds,
            docIds,
            updatedAt: Date.now(),
            verifiedAt: Number(options?.verifiedAt ?? Date.now()) || 0,
        };
        __tmCustomBoardScopeMemoryCache.set(key, entry);
        while (__tmCustomBoardScopeMemoryCache.size > 12) {
            __tmCustomBoardScopeMemoryCache.delete(__tmCustomBoardScopeMemoryCache.keys().next().value);
        }
        if (options?.persist !== false) {
            try {
                __tmRememberDocScope(key, docIds, {
                    groupId: 'custom-board-set',
                    boardDocIds,
                    delayMs: Number(options?.persistDelayMs) || 1200,
                });
            } catch (e) {}
        }
        return resolved;
    }

    function __tmScheduleCustomBoardScopeVerification(cacheKey, boardSet, cachedResolved, resolveOptions, options = {}) {
        const verify = async () => {
            if (String(state.viewMode || '').trim() !== __TM_CUSTOM_BOARD_VIEW_MODE) return;
            if (String(__tmGetActiveCustomBoardSet()?.id || '') !== String(boardSet?.id || '')) return;
            const fresh = await __tmResolveCustomBoardSetDocumentScopesFresh(boardSet, {
                ...resolveOptions,
                forceRefreshScope: false,
                skipPersistedScope: true,
                skipResolvedDocIdsCache: true,
                verifyCachedScope: false,
                preferFastScope: false,
            });
            __tmRememberCustomBoardSetDocumentScopes(cacheKey, fresh, { verifiedAt: Date.now() });
            if (__tmCustomBoardScopeMapsMatch(cachedResolved, fresh)) return;
            if (String(state.viewMode || '').trim() !== __TM_CUSTOM_BOARD_VIEW_MODE) return;
            if (String(__tmGetActiveCustomBoardSet()?.id || '') !== String(boardSet?.id || '')) return;
            const setId = String(boardSet?.id || '').trim();
            const previousDocIds = new Set(Array.isArray(cachedResolved?.docIds) ? cachedResolved.docIds : []);
            const addedDocIds = fresh.docIds.filter((docId) => !previousDocIds.has(docId));
            __tmCustomBoardProjectionCache.delete(setId);
            state.__tmCustomBoardSourceDocIdsByBoard = fresh.boardDocIds;
            let refreshed = addedDocIds.length === 0;
            if (!refreshed && addedDocIds.length <= 12 && typeof __tmRefreshAffectedDocsIncrementally === 'function') {
                try {
                    refreshed = await __tmRefreshAffectedDocsIncrementally({
                        docIds: addedDocIds,
                        allowUnloadedDocIds: true,
                        commitView: false,
                        refreshView: false,
                        persistCaches: true,
                        deferIfDetailBusy: false,
                        reason: 'custom-board-scope-refresh',
                    });
                } catch (e) {
                    refreshed = false;
                }
            }
            if (!refreshed) {
                try {
                    const loaded = await loadSelectedDocuments({
                        source: 'custom-board-scope-refresh',
                        skipRender: true,
                        showInlineLoading: false,
                        preferFastFirstPaint: false,
                        skipFullLoadAfterFastFirstPaint: true,
                    });
                    refreshed = loaded !== false;
                } catch (e) {
                    refreshed = false;
                }
            }
            if (!refreshed) return;
            if (String(state.viewMode || '').trim() !== __TM_CUSTOM_BOARD_VIEW_MODE) return;
            if (String(__tmGetActiveCustomBoardSet()?.id || '').trim() !== setId) return;
            __tmBuildCustomBoardProjection();
            __tmRememberCurrentCustomBoardProjectionCache();
            try { render(); } catch (e) {}
        };
        const runVerification = () => {
            Promise.resolve(verify()).catch(() => null);
        };
        try {
            if (typeof __tmScheduleIdleTask === 'function') __tmScheduleIdleTask(runVerification, Number(options.delayMs) || 900);
            else setTimeout(runVerification, Number(options.delayMs) || 900);
        } catch (e) {}
    }

    async function __tmResolveCustomBoardSetDocumentScopesFresh(boardSet = null, resolveOptions = {}) {
        const set = boardSet && typeof boardSet === 'object' ? boardSet : __tmGetActiveCustomBoardSet();
        const boards = Array.isArray(set?.boards) ? set.boards : [];
        const boardDocIds = {};
        const groupCache = new Map();
        const resolveGroup = async (groupId) => {
            const gid = String(groupId || 'all').trim() || 'all';
            if (!groupCache.has(gid)) {
                groupCache.set(gid, Promise.resolve(resolveDocIdsFromGroups({
                    ...(resolveOptions && typeof resolveOptions === 'object' ? resolveOptions : {}),
                    groupId: gid,
                    includeQuickAddDoc: false,
                    completeScope: true,
                })).catch(() => []));
            }
            return (await groupCache.get(gid)).slice();
        };
        const resolveBoard = async (board) => {
            const scope = __tmNormalizeCustomBoardScope(board?.scope);
            if (scope.mode === 'groups') {
                const groups = Array.from(new Set(scope.groupIds));
                const lists = await Promise.all(groups.map(resolveGroup));
                return Array.from(new Set(lists.flat()));
            }
            if (scope.mode === 'tabGroup') {
                const group = (Array.isArray(SettingsStore?.data?.docTabCustomGroups) ? SettingsStore.data.docTabCustomGroups : [])
                    .find((item) => String(item?.id || '').trim() === scope.tabGroupId) || null;
                const owningGroupId = String(group?.docGroupId || group?.scopeGroupId || group?.documentGroupId || 'all').trim() || 'all';
                if (!group || owningGroupId !== scope.groupId || typeof __tmExpandDocTabCustomGroup !== 'function') return [];
                const groupDocIds = new Set(await resolveGroup(scope.groupId));
                const extraDocs = [
                    ...(Array.isArray(state?.allDocuments) ? state.allDocuments : []),
                    ...(Array.isArray(state?.taskTree) ? state.taskTree : []),
                ];
                const expanded = __tmExpandDocTabCustomGroup(group, extraDocs);
                return Array.from(expanded.keys()).filter((docId) => groupDocIds.has(docId));
            }
            if (scope.mode === 'docs') return scope.docIds.slice();
            return resolveGroup('all');
        };

        const docIds = new Set();
        await Promise.all(boards.map(async (board) => {
            const ids = await resolveBoard(board);
            boardDocIds[board.id] = ids;
            ids.forEach((id) => docIds.add(id));
        }));
        return { boardDocIds, docIds: Array.from(docIds).sort() };
    }

    async function __tmResolveCustomBoardSetDocumentScopes(boardSet = null, resolveOptions = {}) {
        const set = boardSet && typeof boardSet === 'object' ? boardSet : __tmGetActiveCustomBoardSet();
        const options = resolveOptions && typeof resolveOptions === 'object' ? resolveOptions : {};
        const cacheKey = __tmBuildCustomBoardScopeCacheKey(set);
        const useCache = !!cacheKey
            && options.forceRefreshScope !== true
            && options.skipPersistedScope !== true
            && options.skipResolvedDocIdsCache !== true;
        if (useCache) {
            const memoryEntry = __tmCustomBoardScopeMemoryCache.get(cacheKey);
            if (memoryEntry) {
                const cachedResolved = {
                    boardDocIds: Object.fromEntries(Object.entries(memoryEntry.boardDocIds || {}).map(([id, ids]) => [id, ids.slice()])),
                    docIds: memoryEntry.docIds.slice(),
                };
                const verifiedAt = Number(memoryEntry.verifiedAt) || 0;
                if (!verifiedAt || (Date.now() - verifiedAt) > 5 * 60 * 1000) {
                    __tmScheduleCustomBoardScopeVerification(cacheKey, set, cachedResolved, options);
                }
                return cachedResolved;
            }
            try {
                if (typeof __tmLoadDocScopeCacheStore === 'function') await __tmLoadDocScopeCacheStore();
                const cached = typeof __tmGetCachedDocScope === 'function' ? __tmGetCachedDocScope(cacheKey) : null;
                const boardDocIds = __tmNormalizeCachedCustomBoardDocIds(cached?.boardDocIds, set?.boards);
                if (cached && boardDocIds) {
                    const cachedResolved = {
                        boardDocIds,
                        docIds: __tmNormalizeDocScopeDocIds(cached.docIds || []),
                    };
                    __tmRememberCustomBoardSetDocumentScopes(cacheKey, cachedResolved, { verifiedAt: 0, persist: false });
                    __tmScheduleCustomBoardScopeVerification(cacheKey, set, cachedResolved, options);
                    return cachedResolved;
                }
            } catch (e) {}
        }
        const resolved = await __tmResolveCustomBoardSetDocumentScopesFresh(set, options);
        if (cacheKey) __tmRememberCustomBoardSetDocumentScopes(cacheKey, resolved);
        return resolved;
    }

    function __tmBuildCustomBoardProjection(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        if (state.__tmCustomBoardLoading === true && opts.allowWhileLoading !== true) {
            return Array.isArray(state.customBoardProjection) ? state.customBoardProjection : [];
        }
        const set = __tmGetActiveCustomBoardSet();
        const flatTasks = globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {};
        const allTasks = Object.values(flatTasks).filter((task) => task && typeof task === 'object');
        const docIdsByBoard = state.__tmCustomBoardSourceDocIdsByBoard || {};
        const rules = (Array.isArray(state.filterRules) ? state.filterRules : []).filter((rule) => rule && rule.enabled !== false);
        const keyword = String(state.searchKeyword || '').trim();
        const searchFields = keyword && typeof __tmGetTaskSearchFields === 'function'
            ? __tmGetTaskSearchFields()
            : [];
        const dateFilter = globalThis.__tmDateFilter;
        const dateFilterActive = dateFilter?.active?.() === true;
        const parentById = new Map(allTasks.map((task) => [String(task?.id || '').trim(), task]));
        const isHiddenByVisibility = (task) => globalThis.__tmProjectVisibility?.isTaskHidden?.(task) === true;
        const isHiddenByCompletion = (task, rule) => {
            const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
            const includesDone = conditions.some((condition) => condition?.field === 'done'
                && condition?.operator === '='
                && (condition?.value === true || String(condition?.value) === 'true' || condition?.value === ''));
            const allStatuses = conditions.some((condition) => condition?.field === 'done'
                && condition?.operator === '=' && String(condition?.value) === '__all__');
            const done = typeof __tmIsTaskCompletedForProjection === 'function'
                ? __tmIsTaskCompletedForProjection(task)
                : (typeof __tmIsTaskDoneEffective === 'function' ? __tmIsTaskDoneEffective(task) : task?.done === true);
            if (done && state.showCompletedTasks !== true && !includesDone && !allStatuses) return true;
            if (state.showCompletedTasks !== true && typeof __tmIsTaskCanceled === 'function' && __tmIsTaskCanceled(task)) return true;
            let parentId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
            const seen = new Set();
            while (parentId && !seen.has(parentId)) {
                seen.add(parentId);
                const parent = parentById.get(parentId);
                if (!parent) break;
                const parentDone = typeof __tmIsTaskCompletedForProjection === 'function'
                    ? __tmIsTaskCompletedForProjection(parent)
                    : (typeof __tmIsTaskDoneEffective === 'function' ? __tmIsTaskDoneEffective(parent) : parent?.done === true);
                if ((parentDone && state.showCompletedTasks !== true && !includesDone && !allStatuses)
                    || (state.showCompletedTasks !== true && typeof __tmIsTaskCanceled === 'function' && __tmIsTaskCanceled(parent))) return true;
                parentId = String(parent.parentTaskId || parent.parent_task_id || '').trim();
            }
            return false;
        };

        const customOrderTaskPoolByRuleId = new Map();
        const tasksByDocIndex = new WeakMap();
        const buildTasksByDocIndex = (tasks) => {
            if (tasksByDocIndex.has(tasks)) return tasksByDocIndex.get(tasks);
            const index = new Map();
            tasks.forEach((task) => {
                const docId = String(task?.root_id || task?.docId || '').trim();
                if (!docId) return;
                if (!index.has(docId)) index.set(docId, []);
                index.get(docId).push(task);
            });
            tasksByDocIndex.set(tasks, index);
            return index;
        };

        const columns = (Array.isArray(set?.boards) ? set.boards : []).map((board) => {
            const docIds = new Set(Array.isArray(docIdsByBoard[board.id]) ? docIdsByBoard[board.id] : []);
            const rule = rules.find((item) => String(item?.id || '').trim() === board.ruleId) || null;
            const ruleRuntime = {
                fieldInfoCache: new Map(),
                valueMemo: new WeakMap(),
                selectValueMemo: new WeakMap(),
                timeValueMemo: new WeakMap(),
                timeSortMemo: new Map(),
            };
            let taskPool = allTasks;
            if (rule && typeof __tmRuleUsesCustomOrderSort === 'function' && __tmRuleUsesCustomOrderSort(rule)
                && typeof __tmBuildCustomTaskOrderProjection === 'function') {
                const ruleKey = String(rule.id || board.ruleId || '').trim();
                if (!customOrderTaskPoolByRuleId.has(ruleKey)) {
                    let projectedTasks = null;
                    try {
                        const projection = __tmBuildCustomTaskOrderProjection(state.taskTree, rule);
                        if (projection?.flatTasks && typeof projection.flatTasks === 'object') projectedTasks = Object.values(projection.flatTasks);
                    } catch (e) {}
                    customOrderTaskPoolByRuleId.set(ruleKey, projectedTasks);
                }
                taskPool = customOrderTaskPoolByRuleId.get(ruleKey) || allTasks;
            }
            const taskIndex = buildTasksByDocIndex(taskPool);
            let scopeTasks = [];
            docIds.forEach((docId) => scopeTasks.push(...(taskIndex.get(docId) || [])));
            if (typeof __tmIsInboxHiddenFromAllTab === 'function') {
                scopeTasks = scopeTasks.filter((task) => !__tmIsInboxHiddenFromAllTab(task?.root_id || task?.docId));
            }
            const visibleByProject = globalThis.__tmProjectVisibility?.filterTasks?.(scopeTasks);
            if (Array.isArray(visibleByProject)) scopeTasks = visibleByProject;
            scopeTasks = scopeTasks.filter((task) => !isHiddenByVisibility(task) && !isHiddenByCompletion(task, rule));
            const ruleUnavailable = !!board.ruleId && !rule;
            const hasRuleConditions = !!(rule && Array.isArray(rule.conditions) && rule.conditions.length);
            let matched = ruleUnavailable ? [] : scopeTasks;
            if (typeof RuleManager !== 'undefined' && hasRuleConditions) {
                matched = RuleManager.applyRuleFilter(matched, rule, ruleRuntime);
            }
            if (keyword && typeof __tmTaskMatchesSearch === 'function') {
                matched = matched.filter((task) => __tmTaskMatchesSearch(task, keyword, searchFields));
            }
            if (dateFilterActive) {
                try { dateFilter.setCandidates(matched); } catch (e) {}
                matched = matched.filter((task) => dateFilter.matches(task));
            }
            const sortRules = typeof __tmGetNormalizedRuleSorts === 'function'
                ? __tmGetNormalizedRuleSorts(rule)
                : (Array.isArray(rule?.sort) ? rule.sort : []);
            const matchedIds = new Set(matched.map((task) => String(task?.id || '').trim()).filter(Boolean));
            const scopeById = new Map(scopeTasks.map((task) => [String(task?.id || '').trim(), task]).filter(([id]) => !!id));
            const keepWholeMatchedTaskSubtree = rule?.keepMatchedTaskSubtree === true;
            const getScopeRootId = (task) => {
                let currentId = String(task?.id || '').trim();
                let parentId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                const seen = new Set();
                while (currentId && parentId && !seen.has(parentId)) {
                    seen.add(parentId);
                    const parent = scopeById.get(parentId);
                    if (!parent) break;
                    currentId = parentId;
                    parentId = String(parent.parentTaskId || parent.parent_task_id || '').trim();
                }
                return currentId;
            };
            const matchedRootIds = new Set();
            if (keepWholeMatchedTaskSubtree) {
                matched.forEach((task) => {
                    const rootId = getScopeRootId(task);
                    if (rootId) matchedRootIds.add(rootId);
                });
            }
            const ancestorIds = new Set();
            matched.forEach((task) => {
                let parentId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                const seen = new Set();
                while (parentId && !seen.has(parentId)) {
                    seen.add(parentId);
                    const parent = scopeById.get(parentId);
                    if (!parent) break;
                    ancestorIds.add(parentId);
                    parentId = String(parent.parentTaskId || parent.parent_task_id || '').trim();
                }
            });
            const childrenByParentId = new Map();
            scopeTasks.forEach((task) => {
                const id = String(task?.id || '').trim();
                const parentId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                if (!id || !parentId || !scopeById.has(parentId)) return;
                if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
                childrenByParentId.get(parentId).push(task);
            });
            const sortSiblings = (items) => {
                const source = Array.isArray(items) ? items : [];
                if (source.length <= 1) return source;
                if (sortRules.length && typeof RuleManager !== 'undefined') return RuleManager.applyRuleSort(source, rule, ruleRuntime);
                return __tmSortPinnedTasksFirst(source.slice(), (a, b) => {
                    if (typeof __tmCompareTasksByDocFlow === 'function') return __tmCompareTasksByDocFlow(a, b);
                    return 0;
                });
            };
            const tasks = [];
            const visited = new Set();
            const traverse = (siblings, ancestorMatched = false, keepWholeRoot = false) => {
                sortSiblings(siblings).forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (!id || visited.has(id)) return;
                    visited.add(id);
                    if (isHiddenByVisibility(task) || isHiddenByCompletion(task, rule)) return;
                    const isMatched = matchedIds.has(id);
                    const isMatchedRoot = keepWholeMatchedTaskSubtree && matchedRootIds.has(id);
                    const showWholeRoot = keepWholeRoot || isMatchedRoot;
                    const shouldShow = isMatched || ancestorIds.has(id) || showWholeRoot
                        || (!hasRuleConditions && !dateFilterActive && ancestorMatched);
                    if (shouldShow) tasks.push(task);
                    traverse(childrenByParentId.get(id) || [], ancestorMatched || isMatched, showWholeRoot);
                });
            };
            traverse(scopeTasks.filter((task) => {
                const parentId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                return !parentId || !scopeById.has(parentId);
            }));
            scopeTasks.forEach((task) => {
                if (!visited.has(String(task?.id || '').trim())) traverse([task]);
            });
            return { ...board, rule, docIds: Array.from(docIds), tasks };
        });
        const allVisible = [];
        const seenTaskIds = new Set();
        columns.forEach((column) => column.tasks.forEach((task) => {
            const id = String(task?.id || '').trim();
            if (!id || seenTaskIds.has(id)) return;
            seenTaskIds.add(id);
            allVisible.push(task);
        }));
        if (dateFilterActive) {
            try { dateFilter.setCandidates(allVisible); } catch (e) {}
        }
        state.customBoardProjection = columns;
        state.filteredTasks = allVisible;
        state.filteredDocIdsForTabs = [];
        __tmUpdateFilteredTaskRenderWindowState(allVisible);
        try { window.dispatchEvent(new CustomEvent('tm:filtered-tasks-updated')); } catch (e) {}
        __tmRememberCurrentCustomBoardProjectionCache(set);
        return columns;
    }
