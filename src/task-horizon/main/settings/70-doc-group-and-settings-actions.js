    async function __tmSaveDocTabCustomGroups(nextGroups, options = {}) {
        SettingsStore.data.docTabCustomGroups = __tmNormalizeDocTabCustomGroups(nextGroups);
        let activeDocTabGroupReset = false;
        let activeDocTabGroupAffected = false;
        try {
            const activeGroupId = typeof __tmParseDocTabCustomGroupActiveId === 'function'
                ? __tmParseDocTabCustomGroupActiveId(state.activeDocId)
                : '';
            if (activeGroupId) {
                activeDocTabGroupAffected = true;
                const docIds = __tmGetDocTabCustomGroupDocIdSet(activeGroupId, {
                    currentGroupId: SettingsStore?.data?.currentGroupId || 'all',
                    docs: state.taskTree || []
                });
                if (!(docIds instanceof Set) || !docIds.size) {
                    state.activeDocId = 'all';
                    activeDocTabGroupReset = true;
                }
            }
        } catch (e) {}
        await SettingsStore.save();
        if (activeDocTabGroupReset || activeDocTabGroupAffected) {
            try { applyFilters(); } catch (e) {}
        }
        if (state.modal && document.body.contains(state.modal)) {
            try { render(); } catch (e) {}
        }
        if (options?.refreshSettings !== false && state.settingsModal && document.body.contains(state.settingsModal)) {
            try { showSettings(); } catch (e) {}
        }
        if (state.docTabCustomGroupSettingsModal && document.body.contains(state.docTabCustomGroupSettingsModal)) {
            try { __tmRenderDocTabCustomGroupSettingsModal(); } catch (e) {}
        }
        return SettingsStore.data.docTabCustomGroups;
    }

    function __tmCreateDocTabCustomGroupId() {
        const existing = new Set(__tmGetDocTabCustomGroups().map((group) => String(group?.id || '').trim()).filter(Boolean));
        let id = '';
        do {
            id = `tabg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        } while (existing.has(id));
        return id;
    }

    function __tmFindDocTabCustomGroup(groups, groupId) {
        const gid = String(groupId || '').trim();
        if (!gid) return null;
        return (Array.isArray(groups) ? groups : []).find((group) => String(group?.id || '').trim() === gid) || null;
    }

    function __tmIsEditableDocTabCustomGroupForCurrentScope(group) {
        return !!(group && typeof __tmIsDocTabCustomGroupInScope === 'function'
            && __tmIsDocTabCustomGroupInScope(group, __tmGetCurrentDocTabCustomGroupScopeId()));
    }

    function __tmFindEditableDocTabCustomGroup(groups, groupId) {
        const group = __tmFindDocTabCustomGroup(groups, groupId);
        return __tmIsEditableDocTabCustomGroupForCurrentScope(group) ? group : null;
    }

    function __tmGetDocTabCustomGroupCurrentTabBarEntry(groupId) {
        const gid = String(groupId || '').trim();
        if (!gid || typeof __tmBuildDocTabGroupedView !== 'function') return null;
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const visibleDocs = typeof __tmGetVisibleDocTabsForCurrentGroup === 'function'
            ? __tmGetVisibleDocTabsForCurrentGroup()
            : __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId);
        const view = __tmBuildDocTabGroupedView(visibleDocs, {
            currentGroupId,
            activeDocId: state.activeDocId
        });
        return (Array.isArray(view?.groups) ? view.groups : [])
            .find((entry) => String(entry?.id || '').trim() === gid) || null;
    }

    function __tmIsDocTabCustomGroupShownInCurrentTabBar(groupId) {
        return !!__tmGetDocTabCustomGroupCurrentTabBarEntry(groupId);
    }

    function __tmIsDocShownInDocTabCustomGroupCurrentTabBar(docId, groupId) {
        const id = String(docId || '').trim();
        if (!id) return false;
        const entry = __tmGetDocTabCustomGroupCurrentTabBarEntry(groupId);
        return (Array.isArray(entry?.members) ? entry.members : [])
            .some((member) => String(member?.id || '').trim() === id);
    }

    function __tmHintPinnedDocTabCustomGroupPlacement(docId, groupId, actionText = '已加入页签组') {
        const id = String(docId || '').trim();
        const gid = String(groupId || '').trim();
        if (!id || !gid || typeof __tmIsDocPinnedInGroup !== 'function') return false;
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (!__tmIsDocPinnedInGroup(id, currentGroupId)) return false;
        const docShown = __tmIsDocShownInDocTabCustomGroupCurrentTabBar(id, gid);
        const groupShown = __tmIsDocTabCustomGroupShownInCurrentTabBar(gid);
        try {
            const suffix = docShown
                ? '会在页签组内排到最前'
                : (groupShown ? '当前筛选恢复显示后会在页签组内排到最前' : '页签组显示后会在组内排到最前');
            const isExisting = /^该文档已/.test(actionText);
            hint(`${isExisting ? 'ℹ' : '✅'} ${actionText}，该页签已钉住，${suffix}`, isExisting ? 'info' : 'success');
        } catch (e) {}
        return true;
    }

    function __tmResolveDocTabCustomGroupSettingsActiveId(preferredId = '') {
        const groups = __tmGetDocTabCustomGroupsForDocGroup();
        const preferred = String(preferredId || '').trim();
        const fromState = String(state.docTabCustomGroupSettingsActiveGroupId || '').trim();
        const fromActiveTab = typeof __tmParseDocTabCustomGroupActiveId === 'function'
            ? __tmParseDocTabCustomGroupActiveId(state.activeDocId)
            : '';
        const candidates = [preferred, fromState, fromActiveTab]
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        let id = candidates.find((candidate) => groups.some((group) => String(group?.id || '').trim() === candidate)) || '';
        if (!id && groups.length) id = String(groups[0]?.id || '').trim();
        state.docTabCustomGroupSettingsActiveGroupId = id;
        return id;
    }

    function __tmGetDocTabCustomGroupSettingsDocs() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const rawDocs = typeof __tmGetVisibleDocTabsForCurrentGroup === 'function'
            ? __tmGetVisibleDocTabsForCurrentGroup()
            : __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId);
        const metaMap = __tmBuildDocTabGroupDocMetaMap(rawDocs);
        const docs = (Array.isArray(rawDocs) ? rawDocs : [])
            .map((doc) => {
                const id = String(doc?.id || '').trim();
                return id ? { ...(metaMap.get(id) || doc || {}), id } : null;
            })
            .filter(Boolean);
        return typeof __tmSortDocTabCustomGroupMembersForMenu === 'function'
            ? __tmSortDocTabCustomGroupMembersForMenu(docs, rawDocs, { currentGroupId })
            : docs;
    }

    function __tmGetDocTabCustomGroupSettingsContextName() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return '全部文档';
        const group = (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
            .find((item) => String(item?.id || '').trim() === currentGroupId);
        return __tmResolveDocGroupName(group) || '当前文档分组';
    }

    function __tmCloseDocTabCustomGroupSettingsModal() {
        try { state.__docTabCustomGroupSettingsUnstack?.(); } catch (e) {}
        state.__docTabCustomGroupSettingsUnstack = null;
        try { state.docTabCustomGroupSettingsModal?.remove?.(); } catch (e) {}
        state.docTabCustomGroupSettingsModal = null;
    }

    function __tmRenderDocTabCustomGroupSettingsModal() {
        const modal = state.docTabCustomGroupSettingsModal;
        if (!(modal instanceof HTMLElement)) return;
        const allGroups = __tmGetDocTabCustomGroups();
        const groups = __tmGetDocTabCustomGroupsForDocGroup();
        const foreignGroupCount = Math.max(0, allGroups.length - groups.length);
        const activeGroupId = __tmResolveDocTabCustomGroupSettingsActiveId();
        const activeGroup = __tmFindDocTabCustomGroup(groups, activeGroupId);
        const contextName = __tmGetDocTabCustomGroupSettingsContextName();
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const docs = __tmGetDocTabCustomGroupSettingsDocs();
        const currentDocIds = new Set(docs.map((doc) => String(doc?.id || '').trim()).filter(Boolean));
        const entries = Array.isArray(activeGroup?.entries) ? activeGroup.entries : [];
        const directEntryByDocId = new Map(entries.map((entry) => [String(entry?.id || '').trim(), entry]).filter(([id]) => !!id));
        const expanded = activeGroup ? __tmExpandDocTabCustomGroup(activeGroup, docs) : new Map();
        const activeGroupName = String(activeGroup?.name || '').trim() || '未命名页签组';
        const activeGroupColor = activeGroup && typeof __tmGetDocTabCustomGroupColor === 'function'
            ? __tmGetDocTabCustomGroupColor(activeGroup)
            : 'var(--tm-primary-color)';
        const activeGroupHasCustomColor = !!__tmNormalizeHexColor(activeGroup?.color || activeGroup?.tabColor || activeGroup?.bgColor, '');
        const previousBox = modal.querySelector('.tm-doc-tab-group-settings-box');
        const previousActiveGroupId = String(previousBox?.getAttribute?.('data-tm-doc-tab-settings-active-group-id') || '').trim();
        const shouldRestoreScroll = !previousActiveGroupId || previousActiveGroupId === activeGroupId;
        const previousScroll = shouldRestoreScroll ? {
            sidebarTop: Number(modal.querySelector('.tm-doc-tab-group-settings-sidebar')?.scrollTop) || 0,
            mainTop: Number(modal.querySelector('.tm-doc-tab-group-settings-main')?.scrollTop) || 0,
            listTop: Number(modal.querySelector('.tm-doc-tab-group-settings-list')?.scrollTop) || 0,
        } : null;
        const groupsHtml = groups.length ? groups.map((group, index) => {
            const gid = String(group?.id || '').trim();
            if (!gid) return '';
            const name = String(group?.name || '').trim() || '未命名页签组';
            const count = Array.isArray(group?.entries) ? group.entries.length : 0;
            const isFirst = index <= 0;
            const isLast = index >= groups.length - 1;
            return `
                <div class="tm-doc-tab-group-settings-group-row">
                    <button type="button" class="tm-doc-tab-group-settings-group${gid === activeGroupId ? ' is-active' : ''}" onclick="tmSelectDocTabCustomGroupSettingsGroup('${escSq(gid)}')">
                        <span>${esc(name)}</span>
                        <small>${count}</small>
                    </button>
                    <div class="tm-doc-tab-group-settings-sort">
                        <button type="button" class="tm-doc-tab-group-settings-sort-btn" onclick="tmMoveDocTabCustomGroup('${escSq(gid)}', -1, event)" title="上移" aria-label="${esc(`上移页签组：${name}`)}" ${isFirst ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-up', '', { size: 12 })}</button>
                        <button type="button" class="tm-doc-tab-group-settings-sort-btn" onclick="tmMoveDocTabCustomGroup('${escSq(gid)}', 1, event)" title="下移" aria-label="${esc(`下移页签组：${name}`)}" ${isLast ? 'disabled' : ''}>${__tmRenderLucideIcon('arrow-down', '', { size: 12 })}</button>
                    </div>
                </div>
            `;
        }).join('') : `
            <div class="tm-doc-tab-group-settings-empty">暂无页签组</div>
        `;
        const foreignGroupsHtml = foreignGroupCount ? `
            <div class="tm-doc-tab-group-settings-scope-note">
                另有 ${foreignGroupCount} 个页签组属于其他文档分组，当前不可编辑；切换到对应文档分组后再管理。
            </div>
        ` : '';
        const rowsHtml = activeGroup ? (docs.length ? docs.map((doc) => {
            const docId = String(doc?.id || '').trim();
            if (!docId) return '';
            const treeGuideHtml = typeof __tmRenderDocTabGroupTreeGuide === 'function'
                ? __tmRenderDocTabGroupTreeGuide(doc.__tmDocTabGroupMenuLineParts)
                : '';
            const directEntry = directEntryByDocId.get(docId) || null;
            const relation = expanded.get(docId) || null;
            const inherited = !!(relation && relation.direct === false);
            const includeChildren = !!directEntry?.includeChildren;
            const childDocs = __tmGetDocTabChildDocs(docId, docs).filter((child) => String(child?.id || '').trim() !== docId);
            const childDocsInCurrentTabs = childDocs.filter((child) => currentDocIds.has(String(child?.id || '').trim()));
            const docName = __tmGetDocDisplayName(doc, doc.name || '未命名文档');
            const inheritedFromId = inherited ? String(relation?.entryId || '').trim() : '';
            const inheritedFromName = inheritedFromId
                ? __tmGetDocDisplayName(inheritedFromId, __tmGetDocRawName(inheritedFromId, inheritedFromId))
                : '';
            const pinned = __tmIsDocPinnedInGroup(docId, currentGroupId);
            return `
                <div class="tm-doc-tab-group-settings-row${directEntry ? ' is-direct' : ''}${inherited ? ' is-inherited' : ''}${pinned ? ' is-pinned' : ''}">
                    <div class="tm-doc-tab-group-settings-tree">${treeGuideHtml}</div>
                    <div class="tm-doc-tab-group-settings-card">
                        <label class="tm-doc-tab-group-settings-check">
                            <input class="b3-switch fn__flex-center" type="checkbox" ${directEntry ? 'checked' : ''} onchange="tmToggleDocTabCustomGroupDocIncluded('${escSq(activeGroupId)}', '${escSq(docId)}', this.checked)">
                        </label>
                        <div class="tm-doc-tab-group-settings-doc">
                            <div class="tm-doc-tab-group-settings-doc-main">
                                ${__tmRenderDocIcon(doc, { size: 14 })}
                                <span title="${esc(docName)}">${esc(docName)}</span>
                                ${directEntry ? '<em>直接加入</em>' : ''}
                                ${inherited ? `<em>由 ${esc(inheritedFromName || '上级文档')} 带入</em>` : ''}
                                ${pinned ? '<em>已钉住，组内靠前</em>' : ''}
                            </div>
                            <div class="tm-doc-tab-group-settings-doc-sub">
                                ${childDocsInCurrentTabs.length
                                    ? `当前页签中有 ${childDocsInCurrentTabs.length} 个子文档${includeChildren ? '，会随此文档收入分组' : ''}`
                                    : '当前页签中未检测到子文档'}
                            </div>
                        </div>
                        <label class="tm-doc-tab-group-settings-child-toggle${directEntry ? '' : ' is-disabled'}">
                            <input class="b3-switch fn__flex-center" type="checkbox" ${includeChildren ? 'checked' : ''} ${directEntry ? '' : 'disabled'} onchange="tmToggleDocTabCustomGroupEntryChildren('${escSq(activeGroupId)}', '${escSq(docId)}', this.checked)">
                            <span>包含子文档</span>
                        </label>
                    </div>
                </div>
            `;
        }).join('') : `
            <div class="tm-doc-tab-group-settings-empty">当前文档分组没有可选页签</div>
        `) : `
            <div class="tm-doc-tab-group-settings-empty">先新建一个页签组</div>
        `;
        const externalEntries = activeGroup ? entries.filter((entry) => {
            const id = String(entry?.id || '').trim();
            return id && !currentDocIds.has(id);
        }) : [];
        const externalHtml = externalEntries.length ? `
            <div class="tm-doc-tab-group-settings-offscreen">
                <div class="tm-doc-tab-group-settings-section-title">不在当前页签栏的直接成员</div>
                ${externalEntries.map((entry) => {
                    const docId = String(entry?.id || '').trim();
                    const docName = __tmGetDocDisplayName(docId, __tmGetDocRawName(docId, docId));
                    return `
                        <div class="tm-doc-tab-group-settings-offscreen-row">
                            <span>${esc(docName)}</span>
                            <small>${esc(docId.slice(0, 8))}...</small>
                            <button type="button" class="tm-btn tm-btn-danger" onclick="tmRemoveDocFromDocTabCustomGroup('${escSq(activeGroupId)}', '${escSq(docId)}')">移除</button>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="tm-box tm-doc-tab-group-settings-box" data-tm-doc-tab-settings-active-group-id="${esc(activeGroupId)}" onclick="event.stopPropagation()">
                <div class="tm-header">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:var(--tm-text-color);">页签分组设置</div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:3px;">${esc(contextName)} / 仅当前文档分组</div>
                    </div>
                    <button class="tm-btn tm-btn-gray" type="button" onclick="tmCloseDocTabCustomGroupSettings()">关闭</button>
                </div>
                <div class="tm-doc-tab-group-settings-layout">
                    <aside class="tm-doc-tab-group-settings-sidebar">
                        <button type="button" class="tm-btn tm-btn-primary" onclick="tmCreateDocTabCustomGroupFromSettings()" style="width:100%;justify-content:center;">新建页签组</button>
                        <div class="tm-doc-tab-group-settings-groups">${groupsHtml}</div>
                        ${foreignGroupsHtml}
                    </aside>
                    <section class="tm-doc-tab-group-settings-main">
                        ${activeGroup ? `
                            <div class="tm-doc-tab-group-settings-toolbar">
                                <div class="tm-doc-tab-group-settings-title">
                                    <strong>${esc(activeGroupName)}</strong>
                                    <span>${entries.length} 个直接成员，${docs.length} 个当前页签可选</span>
                                </div>
                                <div class="tm-doc-tab-group-settings-actions">
                                    <button type="button" class="tm-btn tm-btn-secondary tm-doc-tab-group-settings-color-btn" onclick="tmSetDocTabCustomGroupColor('${escSq(activeGroupId)}')" title="设置页签组颜色">
                                        ${__tmRenderLucideIcon('brush-cleaning', '', { size: 13 })}
                                        <span class="tm-doc-tab-group-settings-color-swatch" style="background:${esc(activeGroupColor)}"></span>
                                        <span>颜色</span>
                                    </button>
                                    ${activeGroupHasCustomColor ? `<button type="button" class="tm-btn tm-btn-gray" onclick="tmResetDocTabCustomGroupColor('${escSq(activeGroupId)}')">恢复自动</button>` : ''}
                                    <button type="button" class="tm-btn tm-btn-secondary" onclick="tmRenameDocTabCustomGroup('${escSq(activeGroupId)}')">重命名</button>
                                    <button type="button" class="tm-btn tm-btn-danger" onclick="tmDeleteDocTabCustomGroup('${escSq(activeGroupId)}')">删除</button>
                                </div>
                            </div>
                            <div class="tm-doc-tab-group-settings-list">${rowsHtml}</div>
                            ${externalHtml}
                        ` : rowsHtml}
                    </section>
                </div>
                <style>
                    .tm-doc-tab-group-settings-box {
                        width: min(92vw, 880px);
                        height: min(82vh, 680px);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .tm-doc-tab-group-settings-layout {
                        display: grid;
                        grid-template-columns: 220px minmax(0, 1fr);
                        min-height: 0;
                        flex: 1;
                    }
                    .tm-doc-tab-group-settings-sidebar {
                        border-right: 1px solid var(--tm-border-color);
                        padding: 14px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        min-width: 0;
                        overflow: auto;
                    }
                    .tm-doc-tab-group-settings-groups {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .tm-doc-tab-group-settings-group-row {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr) auto;
                        align-items: stretch;
                        gap: 6px;
                        min-width: 0;
                    }
                    .tm-doc-tab-group-settings-group {
                        border: 1px solid var(--tm-border-color);
                        background: var(--tm-bg-color);
                        color: var(--tm-text-color);
                        border-radius: 6px;
                        padding: 8px 9px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        cursor: pointer;
                        min-width: 0;
                        text-align: left;
                    }
                    .tm-doc-tab-group-settings-group span {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .tm-doc-tab-group-settings-group small {
                        color: var(--tm-secondary-text);
                        flex: 0 0 auto;
                    }
                    .tm-doc-tab-group-settings-group.is-active {
                        border-color: var(--tm-primary-color);
                        box-shadow: inset 0 0 0 1px var(--tm-primary-color);
                    }
                    .tm-doc-tab-group-settings-sort {
                        display: flex;
                        align-items: stretch;
                        gap: 4px;
                    }
                    .tm-doc-tab-group-settings-sort-btn {
                        width: 28px;
                        min-width: 28px;
                        border: 1px solid var(--tm-border-color);
                        border-radius: 6px;
                        background: var(--tm-bg-color);
                        color: var(--tm-secondary-text);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        cursor: pointer;
                    }
                    .tm-doc-tab-group-settings-sort-btn:hover:not(:disabled) {
                        background: var(--tm-hover-bg);
                        color: var(--tm-text-color);
                    }
                    .tm-doc-tab-group-settings-sort-btn:disabled {
                        cursor: not-allowed;
                        opacity: 0.42;
                    }
                    .tm-doc-tab-group-settings-sort-btn svg {
                        width: 12px;
                        height: 12px;
                        display: block;
                    }
                    .tm-doc-tab-group-settings-main {
                        min-width: 0;
                        min-height: 0;
                        display: flex;
                        flex-direction: column;
                        padding: 14px;
                        gap: 12px;
                        overflow: hidden;
                    }
                    .tm-doc-tab-group-settings-toolbar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        flex-wrap: wrap;
                    }
                    .tm-doc-tab-group-settings-title {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                        min-width: 0;
                    }
                    .tm-doc-tab-group-settings-title strong {
                        font-size: 15px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .tm-doc-tab-group-settings-title span,
                    .tm-doc-tab-group-settings-empty,
                    .tm-doc-tab-group-settings-section-title {
                        font-size: 12px;
                        color: var(--tm-secondary-text);
                    }
                    .tm-doc-tab-group-settings-actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .tm-doc-tab-group-settings-color-btn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        line-height: 1;
                    }
                    .tm-doc-tab-group-settings-color-btn svg {
                        display: block;
                        width: 13px;
                        height: 13px;
                        flex: 0 0 auto;
                        transform: translateY(-1px);
                    }
                    .tm-doc-tab-group-settings-color-swatch {
                        display: inline-block;
                        width: 14px;
                        height: 14px;
                        border-radius: 4px;
                        border: 1px solid color-mix(in srgb, var(--tm-text-color) 18%, transparent);
                        box-sizing: border-box;
                        flex: 0 0 auto;
                    }
                    .tm-doc-tab-group-settings-list {
                        min-height: 0;
                        overflow: auto;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        padding-right: 2px;
                    }
                    .tm-doc-tab-group-settings-row {
                        display: grid;
                        grid-template-columns: auto minmax(0, 1fr);
                        align-items: stretch;
                        gap: 6px;
                    }
                    .tm-doc-tab-group-settings-card {
                        display: grid;
                        grid-template-columns: 34px minmax(0, 1fr) auto;
                        align-items: center;
                        gap: 10px;
                        border: 1px solid var(--tm-border-color);
                        border-radius: 7px;
                        background: var(--tm-card-bg);
                        padding: 9px 10px;
                        min-width: 0;
                    }
                    .tm-doc-tab-group-settings-tree {
                        align-self: stretch;
                        display: flex;
                        align-items: stretch;
                        min-width: 0;
                    }
                    .tm-doc-tab-group-settings-tree .tm-doc-tab-tree-guide {
                        height: auto;
                        margin: 0;
                    }
                    .tm-doc-tab-group-settings-tree .tm-doc-tab-tree-guide-seg::before,
                    .tm-doc-tab-group-settings-tree .tm-doc-tab-tree-guide-seg::after {
                        content: none;
                        display: none;
                    }
                    .tm-doc-tab-group-settings-row.is-inherited .tm-doc-tab-group-settings-card {
                        background: color-mix(in srgb, var(--tm-primary-color) 5%, var(--tm-card-bg));
                    }
                    .tm-doc-tab-group-settings-check {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .tm-doc-tab-group-settings-doc {
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .tm-doc-tab-group-settings-doc-main {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                    }
                    .tm-doc-tab-group-settings-doc-main > span {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .tm-doc-tab-group-settings-doc-main em {
                        font-style: normal;
                        flex: 0 0 auto;
                        font-size: 11px;
                        color: var(--tm-secondary-text);
                        background: var(--tm-hover-bg);
                        border-radius: 999px;
                        padding: 1px 6px;
                    }
                    .tm-doc-tab-group-settings-doc-sub {
                        font-size: 12px;
                        color: var(--tm-secondary-text);
                        line-height: 1.5;
                    }
                    .tm-doc-tab-group-settings-child-toggle {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 12px;
                        color: var(--tm-text-color);
                        white-space: nowrap;
                    }
                    .tm-doc-tab-group-settings-child-toggle.is-disabled {
                        color: var(--tm-secondary-text);
                        opacity: 0.62;
                    }
                    .tm-doc-tab-group-settings-offscreen {
                        border-top: 1px solid var(--tm-border-color);
                        padding-top: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .tm-doc-tab-group-settings-offscreen-row {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr) auto auto;
                        gap: 8px;
                        align-items: center;
                        font-size: 12px;
                    }
                    .tm-doc-tab-group-settings-offscreen-row span {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .tm-doc-tab-group-settings-offscreen-row small {
                        color: var(--tm-secondary-text);
                    }
                    .tm-doc-tab-group-settings-empty {
                        padding: 16px;
                        border: 1px dashed var(--tm-border-color);
                        border-radius: 8px;
                        background: var(--tm-rule-group-bg);
                    }
                    .tm-doc-tab-group-settings-scope-note {
                        padding: 10px;
                        border: 1px solid var(--tm-border-color);
                        border-radius: 7px;
                        background: var(--tm-rule-group-bg);
                        color: var(--tm-secondary-text);
                        font-size: 12px;
                        line-height: 1.5;
                    }
                    @media (max-width: 720px) {
                        .tm-doc-tab-group-settings-box {
                            width: 100vw;
                            height: 100dvh;
                            border-radius: 0;
                        }
                        .tm-doc-tab-group-settings-layout {
                            grid-template-columns: 1fr;
                            grid-template-rows: auto minmax(0, 1fr);
                        }
                        .tm-doc-tab-group-settings-sidebar {
                            border-right: 0;
                            border-bottom: 1px solid var(--tm-border-color);
                            max-height: 180px;
                        }
                        .tm-doc-tab-group-settings-row {
                            grid-template-columns: auto minmax(0, 1fr);
                        }
                        .tm-doc-tab-group-settings-card {
                            grid-template-columns: 34px minmax(0, 1fr);
                        }
                        .tm-doc-tab-group-settings-child-toggle {
                            grid-column: 2;
                            justify-self: start;
                        }
                    }
                </style>
            </div>
        `;
        if (previousScroll) {
            const restoreScroll = () => {
                const restore = (selector, top) => {
                    const el = modal.querySelector(selector);
                    if (!(el instanceof HTMLElement)) return;
                    const maxTop = Math.max(0, (Number(el.scrollHeight) || 0) - (Number(el.clientHeight) || 0));
                    el.scrollTop = Math.max(0, Math.min(Number(top) || 0, maxTop));
                };
                restore('.tm-doc-tab-group-settings-sidebar', previousScroll.sidebarTop);
                restore('.tm-doc-tab-group-settings-main', previousScroll.mainTop);
                restore('.tm-doc-tab-group-settings-list', previousScroll.listTop);
            };
            try { requestAnimationFrame(restoreScroll); } catch (e) { try { restoreScroll(); } catch (e2) {} }
            try { setTimeout(restoreScroll, 0); } catch (e) {}
        }
    }

    window.tmCreateDocTabCustomGroupWithDoc = async function(docId) {
        const id = String(docId || '').trim();
        if (!id) {
            hint('⚠ 未找到当前文档', 'warning');
            return null;
        }
        const docName = __tmGetDocDisplayName(id, __tmGetDocRawName(id, '未命名文档'));
        const name = await showPrompt('新建页签组', '请输入页签组名称', docName || '新页签组');
        if (name === null || name === undefined) return null;
        const groupName = String(name || '').trim();
        if (!groupName) {
            hint('⚠ 页签组名称不能为空', 'warning');
            return null;
        }
        const groups = __tmGetDocTabCustomGroups();
        const group = {
            id: __tmCreateDocTabCustomGroupId(),
            docGroupId: __tmGetCurrentDocTabCustomGroupScopeId(),
            name: groupName,
            showInTabBar: true,
            entries: [{ id, includeChildren: false }]
        };
        groups.push(group);
        state.docTabCustomGroupSettingsActiveGroupId = group.id;
        await __tmSaveDocTabCustomGroups(groups);
        const warned = __tmHintPinnedDocTabCustomGroupPlacement(id, group.id, `已新建页签组“${groupName}”`);
        if (!warned) hint(`✅ 已新建页签组“${groupName}”`, 'success');
        return group;
    };

    window.tmCreateDocTabCustomGroupFromSettings = async function() {
        const name = await showPrompt('新建页签组', '请输入页签组名称', '新页签组');
        if (name === null || name === undefined) return null;
        const groupName = String(name || '').trim();
        if (!groupName) {
            hint('⚠ 页签组名称不能为空', 'warning');
            return null;
        }
        const groups = __tmGetDocTabCustomGroups();
        const group = {
            id: __tmCreateDocTabCustomGroupId(),
            docGroupId: __tmGetCurrentDocTabCustomGroupScopeId(),
            name: groupName,
            showInTabBar: true,
            entries: []
        };
        groups.push(group);
        state.docTabCustomGroupSettingsActiveGroupId = group.id;
        await __tmSaveDocTabCustomGroups(groups);
        hint(`✅ 已创建页签组“${groupName}”`, 'success');
        return group;
    };

    window.tmAddDocToDocTabCustomGroup = async function(groupId, docId, includeChildren = false) {
        const gid = String(groupId || '').trim();
        const id = String(docId || '').trim();
        if (!gid || !id) return false;
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) {
            hint('⚠ 当前文档分组下未找到该页签组', 'warning');
            return false;
        }
        if (!Array.isArray(group.entries)) group.entries = [];
        const existing = group.entries.find((entry) => String(entry?.id || '').trim() === id);
        if (existing) {
            existing.includeChildren = !!(existing.includeChildren || includeChildren);
            await __tmSaveDocTabCustomGroups(groups);
            const warned = __tmHintPinnedDocTabCustomGroupPlacement(id, gid, `该文档已在“${group.name || '未命名页签组'}”中`);
            if (!warned) hint(`ℹ 该文档已在“${group.name || '未命名页签组'}”中`, 'info');
            return true;
        }
        group.entries.push({ id, includeChildren: !!includeChildren });
        await __tmSaveDocTabCustomGroups(groups);
        const warned = __tmHintPinnedDocTabCustomGroupPlacement(id, gid, `已添加到页签组“${group.name || '未命名页签组'}”`);
        if (!warned) hint(`✅ 已添加到页签组“${group.name || '未命名页签组'}”`, 'success');
        return true;
    };

    window.tmAddDocTabCustomGroupEntryFromInput = async function(groupId, buttonEl) {
        const btn = buttonEl instanceof HTMLElement ? buttonEl : null;
        const input = btn?.parentElement?.querySelector?.('[data-tm-doc-tab-group-entry-input]');
        const docId = String(input?.value || '').trim();
        if (!docId) {
            hint('⚠ 请输入文档 ID', 'warning');
            return;
        }
        const ok = await window.tmAddDocToDocTabCustomGroup?.(groupId, docId, false);
        if (ok && input) input.value = '';
    };

    window.tmRemoveDocFromDocTabCustomGroup = async function(groupId, docId) {
        const gid = String(groupId || '').trim();
        const id = String(docId || '').trim();
        if (!gid || !id) return false;
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group || !Array.isArray(group.entries)) return false;
        const before = group.entries.length;
        group.entries = group.entries.filter((entry) => String(entry?.id || '').trim() !== id);
        if (group.entries.length === before) {
            hint('⚠ 该文档不是页签组的直接成员', 'warning');
            return false;
        }
        await __tmSaveDocTabCustomGroups(groups);
        hint(`✅ 已从页签组“${group.name || '未命名页签组'}”移除`, 'success');
        return true;
    };

    window.tmToggleDocTabCustomGroupEntryChildren = async function(groupId, docId, includeChildren) {
        const gid = String(groupId || '').trim();
        const id = String(docId || '').trim();
        if (!gid || !id) return;
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        const entry = Array.isArray(group?.entries)
            ? group.entries.find((item) => String(item?.id || '').trim() === id)
            : null;
        if (!entry) return;
        entry.includeChildren = !!includeChildren;
        await __tmSaveDocTabCustomGroups(groups);
    };

    window.tmRenameDocTabCustomGroup = async function(groupId) {
        const gid = String(groupId || '').trim();
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) return;
        const oldName = String(group.name || '').trim() || '未命名页签组';
        const next = await showPrompt('重命名页签组', '请输入新的页签组名称', oldName);
        if (next === null || next === undefined) return;
        const name = String(next || '').trim();
        if (!name) {
            hint('⚠ 页签组名称不能为空', 'warning');
            return;
        }
        if (name === oldName) return;
        group.name = name;
        await __tmSaveDocTabCustomGroups(groups);
        hint('✅ 页签组已重命名', 'success');
    };

    window.tmSetDocTabCustomGroupColor = function(groupId) {
        const gid = String(groupId || '').trim();
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) {
            hint('⚠ 当前文档分组下未找到该页签组', 'warning');
            return;
        }
        const initial = __tmNormalizeHexColor(group.color || group.tabColor || group.bgColor, '#3b82f6') || '#3b82f6';
        __tmOpenColorPickerDialog('页签组颜色', initial, async (next) => {
            const color = __tmNormalizeHexColor(next, '');
            if (!color) return;
            group.color = color;
            delete group.tabColor;
            delete group.bgColor;
            await __tmSaveDocTabCustomGroups(groups, { refreshSettings: true });
            hint('✅ 页签组颜色已更新', 'success');
        }, __tmBuildPresetColorPickerOptions(initial));
    };

    window.tmResetDocTabCustomGroupColor = async function(groupId) {
        const gid = String(groupId || '').trim();
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) {
            hint('⚠ 当前文档分组下未找到该页签组', 'warning');
            return;
        }
        const hadCustomColor = !!__tmNormalizeHexColor(group.color || group.tabColor || group.bgColor, '');
        delete group.color;
        delete group.tabColor;
        delete group.bgColor;
        if (!hadCustomColor) return;
        await __tmSaveDocTabCustomGroups(groups, { refreshSettings: true });
        hint('✅ 已恢复页签组自动颜色', 'success');
    };

    window.tmDeleteDocTabCustomGroup = async function(groupId) {
        const gid = String(groupId || '').trim();
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) return;
        const name = String(group.name || '').trim() || '未命名页签组';
        if (typeof showConfirm !== 'function') {
            hint('⚠ 删除确认弹窗不可用，请刷新后重试', 'warning');
            return;
        }
        const ok = await showConfirm('删除页签组', `确定要删除页签组“${name}”吗？`);
        if (!ok) return;
        if (typeof __tmParseDocTabCustomGroupActiveId === 'function' && __tmParseDocTabCustomGroupActiveId(state.activeDocId) === gid) {
            state.activeDocId = 'all';
        }
        if (String(state.docTabCustomGroupSettingsActiveGroupId || '').trim() === gid) {
            state.docTabCustomGroupSettingsActiveGroupId = '';
        }
        await __tmSaveDocTabCustomGroups(groups.filter((item) => String(item?.id || '').trim() !== gid));
        hint('✅ 页签组已删除', 'success');
    };

    window.tmSelectDocTabCustomGroupSettingsGroup = function(groupId) {
        const gid = String(groupId || '').trim();
        state.docTabCustomGroupSettingsActiveGroupId = gid;
        __tmRenderDocTabCustomGroupSettingsModal();
    };

    window.tmMoveDocTabCustomGroup = async function(groupId, direction, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const gid = String(groupId || '').trim();
        const step = Number(direction) < 0 ? -1 : 1;
        if (!gid) return false;
        const groups = __tmGetDocTabCustomGroups();
        const currentScopeId = __tmGetCurrentDocTabCustomGroupScopeId();
        const scopedIds = groups
            .filter((group) => __tmIsDocTabCustomGroupInScope(group, currentScopeId))
            .map((group) => String(group?.id || '').trim())
            .filter(Boolean);
        const scopedIndex = scopedIds.indexOf(gid);
        if (scopedIndex < 0) {
            hint('⚠ 当前文档分组下未找到该页签组', 'warning');
            return false;
        }
        const targetScopedIndex = scopedIndex + step;
        if (targetScopedIndex < 0 || targetScopedIndex >= scopedIds.length) return false;
        const targetId = scopedIds[targetScopedIndex];
        if (!targetId || targetId === gid) return false;
        const scopedGroups = groups.filter((group) => __tmIsDocTabCustomGroupInScope(group, currentScopeId));
        const [moved] = scopedGroups.splice(scopedIndex, 1);
        scopedGroups.splice(targetScopedIndex, 0, moved);
        let nextScopedIndex = 0;
        const nextGroups = groups.map((group) => {
            if (!__tmIsDocTabCustomGroupInScope(group, currentScopeId)) return group;
            const nextGroup = scopedGroups[nextScopedIndex];
            nextScopedIndex += 1;
            return nextGroup || group;
        });
        state.docTabCustomGroupSettingsActiveGroupId = gid;
        await __tmSaveDocTabCustomGroups(nextGroups, { refreshSettings: true });
        hint('✅ 页签组排序已更新', 'success');
        return true;
    };

    window.tmToggleDocTabCustomGroupDocIncluded = async function(groupId, docId, included) {
        const gid = String(groupId || '').trim();
        const id = String(docId || '').trim();
        if (!gid || !id) return;
        const groups = __tmGetDocTabCustomGroups();
        const group = __tmFindEditableDocTabCustomGroup(groups, gid);
        if (!group) {
            hint('⚠ 当前文档分组下未找到该页签组', 'warning');
            return;
        }
        if (!Array.isArray(group.entries)) group.entries = [];
        const before = group.entries.length;
        if (included) {
            const existing = group.entries.find((entry) => String(entry?.id || '').trim() === id);
            if (!existing) group.entries.push({ id, includeChildren: false });
        } else {
            group.entries = group.entries.filter((entry) => String(entry?.id || '').trim() !== id);
        }
        const changed = included
            ? group.entries.length !== before
            : group.entries.length !== before;
        await __tmSaveDocTabCustomGroups(groups, { refreshSettings: true });
        if (changed) {
            const warned = included ? __tmHintPinnedDocTabCustomGroupPlacement(id, gid, '已加入页签组') : false;
            if (!warned) {
                try { hint(included ? '✅ 已加入页签组' : '✅ 已移出页签组', 'success'); } catch (e) {}
            }
        }
    };

    window.tmCloseDocTabCustomGroupSettings = function() {
        __tmCloseDocTabCustomGroupSettingsModal();
    };

    window.tmOpenDocTabCustomGroupSettings = function(groupId = '') {
        try { __tmHideDocTabMenu?.(); } catch (e) {}
        const preferred = String(groupId || '').trim();
        if (preferred) state.docTabCustomGroupSettingsActiveGroupId = preferred;
        if (state.docTabCustomGroupSettingsModal && document.body.contains(state.docTabCustomGroupSettingsModal)) {
            __tmRenderDocTabCustomGroupSettingsModal();
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'tm-modal tm-doc-tab-group-settings-modal';
        modal.style.zIndex = '200004';
        modal.onclick = (ev) => {
            if (ev.target === modal) __tmCloseDocTabCustomGroupSettingsModal();
        };
        state.docTabCustomGroupSettingsModal = modal;
        document.body.appendChild(modal);
        __tmRenderDocTabCustomGroupSettingsModal();
        try {
            state.__docTabCustomGroupSettingsUnstack = __tmModalStackBind(() => __tmCloseDocTabCustomGroupSettingsModal());
        } catch (e) {}
        try {
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-doc-tab-group-settings-box'), {
                scaleFrom: 0.985,
                translateY: '8px'
            });
        } catch (e) {}
    };

    window.clearCurrentGroupDocs = async function() {
        if (!confirm('确定要清空当前分组的所有文档吗？')) return;

        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;

        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group) {
            group.docs = [];
            group.excludedDocIds = [];
            delete group.notebookId;
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    // 新增：从分组移除文档
    window.removeDocFromGroup = async function(index) {
        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;

        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group && group.docs) {
            const removed = group.docs.splice(index, 1)[0];
            const removedDocId = String((typeof removed === 'object' ? removed?.id : removed) || '').trim();
            if (removedDocId) {
                group.excludedDocIds = __tmGetGroupExcludedDocIds(group).filter((id) => id !== removedDocId);
            }
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    window.removeDocFromGroupById = async function(docId) {
        const id = String(docId || '').trim();
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (!id || currentId === 'all') return;

        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => String(g?.id || '').trim() === currentId);
        if (!group || !Array.isArray(group.docs)) {
            hint('⚠ 未找到该分组文档', 'warning');
            return;
        }
        const before = group.docs.length;
        group.docs = group.docs.filter((doc) => String((typeof doc === 'object' ? doc?.id : doc) || '').trim() !== id);
        if (group.docs.length === before) {
            hint('⚠ 该文档不是手动添加的分组文档', 'warning');
            return;
        }
        group.excludedDocIds = __tmGetGroupExcludedDocIds(group).filter((item) => item !== id);
        await SettingsStore.updateDocGroups(groups);
        showSettings();
    };

    window.removeOtherBlockSourceDocFromGroup = async function(docId, groupId) {
        const id = String(docId || '').trim();
        let targetGroupId = String(groupId || '').trim();
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (!id) return;
        if (!targetGroupId) targetGroupId = currentId === 'all' ? '' : currentId;
        if (!targetGroupId) {
            hint('⚠ 未找到其他块所在分组', 'warning');
            return;
        }

        let sourceDocs = Array.isArray(state.otherBlockSourceDocsByGroup?.[targetGroupId])
            ? state.otherBlockSourceDocsByGroup[targetGroupId]
            : [];
        let sourceDoc = sourceDocs.find((item) => String(item?.id || item?.docId || '').trim() === id);

        if (!sourceDoc && typeof __tmEnsureOtherBlockSourceDocsForGroup === 'function') {
            try {
                sourceDocs = await __tmEnsureOtherBlockSourceDocsForGroup(targetGroupId, { force: true });
                sourceDoc = (Array.isArray(sourceDocs) ? sourceDocs : [])
                    .find((item) => String(item?.id || item?.docId || '').trim() === id);
            } catch (e) {}
        }

        let blockIds = Array.from(new Set((Array.isArray(sourceDoc?.otherBlockIds) ? sourceDoc.otherBlockIds : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)));

        try {
            const refs = typeof __tmGetOtherBlockRefsByGroup === 'function'
                ? __tmGetOtherBlockRefsByGroup(targetGroupId)
                : [];
            if (Array.isArray(refs) && refs.length) {
                const rows = await API.getOtherBlocksByIds(refs.map((item) => item.id));
                const byId = new Map();
                (Array.isArray(rows) ? rows : []).forEach((row) => {
                    const blockId = String(row?.id || '').trim();
                    const type = String(row?.type || '').trim().toLowerCase();
                    const rowDocId = type === 'd'
                        ? String(row?.id || row?.root_id || '').trim()
                        : String(row?.root_id || row?.docId || '').trim();
                    const canResolve = typeof __tmCanResolveOtherBlockSourceDoc === 'function'
                        ? __tmCanResolveOtherBlockSourceDoc(row?.type, row?.subtype)
                        : (typeof __tmIsSupportedOtherBlockType === 'function' && __tmIsSupportedOtherBlockType(row?.type, row?.subtype));
                    if (blockId && rowDocId === id && canResolve) byId.set(blockId, true);
                });
                blockIds.forEach((blockId) => byId.set(blockId, true));
                blockIds = Array.from(byId.keys());
            }
        } catch (e) {}

        if (!blockIds.length) {
            hint('⚠ 未找到该文档对应的其他块', 'warning');
            return;
        }

        const result = await __tmRemoveOtherBlocksFromCollection(blockIds, targetGroupId, {
            forceRefresh: targetGroupId === currentId,
        });
        if (result?.removed > 0) {
            try { await __tmEnsureOtherBlockSourceDocsForGroup?.(targetGroupId, { force: true }); } catch (e) {}
            hint(`✅ 已移除 ${result.removed} 个其他块`, 'success');
            showSettings();
        }
    };

    window.removeExcludedDocFromCurrentGroup = async function(docId) {
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const result = await __tmSetDocExcludedForGroup(docId, false, currentId);
        if (!result?.changed) {
            hint('⚠ 该文档不在排除列表中', 'warning');
            return;
        }
        hint('✅ 已从排除列表移出，文档会重新显示', 'success');
    };

    window.removeDocFromAll = async function(docId) {
        const id = String(docId || '').trim();
        if (!id) return;

        let changed = false;

        try {
            const legacy = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            const nextLegacy = legacy.filter(x => String(x) !== id);
            if (nextLegacy.length !== legacy.length) {
                SettingsStore.data.selectedDocIds = nextLegacy;
                changed = true;
            }
        } catch (e) {}

        try {
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            let groupsChanged = false;
            groups.forEach(g => {
                if (!g || !Array.isArray(g.docs)) return;
                const before = g.docs.length;
                g.docs = g.docs.filter(d => String((typeof d === 'object' ? d?.id : d) || '') !== id);
                const excludedBefore = __tmGetGroupExcludedDocIds(g);
                g.excludedDocIds = excludedBefore.filter((item) => item !== id);
                if (g.excludedDocIds.length !== excludedBefore.length) groupsChanged = true;
                if (g.docs.length !== before) groupsChanged = true;
            });
            if (groupsChanged) {
                SettingsStore.data.docGroups = groups;
                changed = true;
            }
        } catch (e) {}

        try {
            const excludedAll = __tmGetAllDocsExcludedDocIds();
            const nextExcludedAll = excludedAll.filter((item) => item !== id);
            if (nextExcludedAll.length !== excludedAll.length) {
                SettingsStore.data.allDocsExcludedDocIds = nextExcludedAll;
                changed = true;
            }
        } catch (e) {}

        try {
            const pinMap = (SettingsStore.data.docPinnedByGroup && typeof SettingsStore.data.docPinnedByGroup === 'object')
                ? SettingsStore.data.docPinnedByGroup
                : {};
            let pinChanged = false;
            Object.keys(pinMap).forEach((gid) => {
                const arr = Array.isArray(pinMap[gid]) ? pinMap[gid] : [];
                const next = arr.map(x => String(x || '').trim()).filter(Boolean).filter(x => x !== id);
                if (next.length !== arr.length) {
                    pinMap[gid] = next;
                    pinChanged = true;
                }
            });
            if (pinChanged) {
                SettingsStore.data.docPinnedByGroup = pinMap;
                changed = true;
            }
        } catch (e) {}

        try {
            if (String(SettingsStore.data.defaultDocId || '').trim() === id) {
                SettingsStore.data.defaultDocId = '';
                changed = true;
            }
        } catch (e) {}

        if (!changed) {
            hint('⚠ 未找到该文档', 'warning');
            return;
        }

        await SettingsStore.save();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings();
    };

    // 手动添加文档ID（增强版）
    window.addManualDoc = async function() {
        const input = document.getElementById('manualDocId');
        const recursiveCheck = document.getElementById('recursiveCheck');
        const docId = input.value.trim();
        const isRecursive = recursiveCheck ? recursiveCheck.checked : false;

        if (!docId) {
            hint('⚠ 请输入文档ID', 'warning');
            return;
        }

        // 验证ID格式（思源笔记ID格式：数字-字母数字组合）
        if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(docId)) {
            hint('⚠ 文档ID格式不正确，格式应为：数字-字母数字组合', 'warning');
            return;
        }

        const currentGroupId = SettingsStore.data.currentGroupId || 'all';

        if (currentGroupId === 'all') {
            // 添加到旧版列表（不支持递归标志，或者我们需要升级旧版列表结构）
            // 为了兼容，我们在 "全部" 模式下只操作 selectedDocIds
            if (isRecursive) {
                hint('⚠ "全部文档"模式下不支持递归选项，请先创建或选择一个分组', 'warning');
                return;
            }
            if (SettingsStore.data.selectedDocIds.includes(docId)) {
                hint('⚠ 该文档已被添加', 'warning');
                return;
            }
            await SettingsStore.addDocId(docId);
        } else {
            // 添加到当前分组
            const groups = SettingsStore.data.docGroups || [];
            const group = groups.find(g => g.id === currentGroupId);
            if (group) {
                if (!group.docs) group.docs = [];
                // 检查重复
                if (group.docs.some(d => d.id === docId)) {
                    hint('⚠ 该文档已在当前分组中', 'warning');
                    return;
                }
                group.docs.push({ id: docId, recursive: isRecursive });
                await SettingsStore.updateDocGroups(groups);
            }
        }

        // 尝试获取文档名称
        fetchDocMeta(docId).then((docMeta) => {
            if (docMeta?.name) {
                state.allDocuments.push({ id: docId, name: docMeta.name, alias: '', icon: __tmNormalizeDocIconValue(docMeta.icon), path: '', taskCount: 0 });
            }
            showSettings(); // 重新渲染设置界面
        });

        input.value = '';
        if (recursiveCheck) recursiveCheck.checked = false;
        hint('✅ 已添加文档', 'success');
    };

    async function __tmAddDocsToGroup(docIdsInput, groupId, options = {}) {
        const docIds = __tmNormalizeDocIdsForGroupInput(docIdsInput);
        const targetGroupId = String(groupId || '').trim();
        if (!docIds.length) {
            hint('⚠ 未找到可添加的文档', 'warning');
            return { added: 0, existed: 0, group: null };
        }
        if (!targetGroupId) {
            hint('⚠ 请选择目标分组', 'warning');
            return { added: 0, existed: 0, group: null };
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === targetGroupId);
        if (!group) {
            hint('⚠ 目标分组不存在', 'warning');
            return { added: 0, existed: 0, group: null };
        }

        if (!Array.isArray(group.docs)) group.docs = [];
        let added = 0;
        let existed = 0;
        docIds.forEach((docId) => {
            const exists = group.docs.some((item) => String((typeof item === 'object' ? item?.id : item) || '').trim() === docId);
            if (exists) {
                existed += 1;
                return;
            }
            group.docs.push({ id: docId, recursive: false });
            added += 1;
        });

        if (!added) {
            const groupName = __tmResolveDocGroupName(group);
            hint(docIds.length > 1 ? `⚠ 所选文档已都在分组“${groupName}”中` : `⚠ 该文档已在分组“${groupName}”中`, 'warning');
            return { added: 0, existed, group };
        }

        await SettingsStore.updateDocGroups(groups);

        await Promise.allSettled(docIds.map(async (docId) => {
            const docMeta = await fetchDocMeta(docId);
            if (!docMeta?.name) return;
            if (!Array.isArray(state.allDocuments)) state.allDocuments = [];
            const exists = state.allDocuments.some((item) => String(item?.id || '').trim() === docId);
            if (!exists) state.allDocuments.push({ id: docId, name: docMeta.name, alias: '', icon: __tmNormalizeDocIconValue(docMeta.icon), path: '', taskCount: 0 });
        }));

        try {
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            if (currentGroupId === targetGroupId || currentGroupId === 'all' || options.forceRefresh) {
                await loadSelectedDocuments();
                render();
                if (state.settingsModal) showSettings();
            }
        } catch (e) {}

        return { added, existed, group };
    }

    async function __tmEnsureSourceDocGroupForAction(docIdInput, options = {}) {
        const docId = String(docIdInput || '').trim();
        if (!docId) return { groupId: '', group: null, reason: 'no-doc' };

        const existingGroupId = await __tmResolveOtherBlockTargetGroupIdByDoc(docId);
        if (existingGroupId) {
            return { groupId: existingGroupId, group: __tmGetDocGroupById(existingGroupId), reason: 'existing' };
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) {
            hint('⚠ 请先在任务管理器中创建文档分组', 'warning');
            return { groupId: '', group: null, reason: 'no-groups' };
        }

        const currentGroupId = String(SettingsStore.data.currentGroupId || '').trim();
        const defaultGroupId = groups.some((item) => String(item?.id || '').trim() === currentGroupId)
            ? currentGroupId
            : String(groups[0]?.id || '').trim();
        const selectOptions = groups.map((group) => ({
            value: String(group?.id || '').trim(),
            label: __tmResolveDocGroupName(group)
        })).filter((item) => item.value);
        if (!selectOptions.length) {
            hint('⚠ 当前没有可用的文档分组', 'warning');
            return { groupId: '', group: null, reason: 'no-groups' };
        }

        const title = String(options?.title || '选择文档分组').trim() || '选择文档分组';
        const selectedGroupId = await showSelectPrompt(title, selectOptions, defaultGroupId);
        if (!selectedGroupId) return { groupId: '', group: null, reason: 'cancelled' };

        const result = await __tmAddDocsToGroup([docId], selectedGroupId, {
            ...options,
            forceRefresh: options?.forceRefresh !== false,
        });
        if (!result?.group) return { groupId: '', group: null, reason: 'add-failed' };

        try { window.__tmCalendarDocsToGroupCache = null; } catch (e) {}
        try { await window.tmCalendarWarmDocsToGroupCache?.(); } catch (e) {}

        const groupId = String(result.group?.id || selectedGroupId || '').trim();
        return {
            groupId,
            group: result.group,
            reason: result.added ? 'added' : 'existing',
            added: result.added,
            existed: result.existed,
        };
    }

    window.tmOpenAddDocToGroupDialog = async function(docIdsInput, options = {}) {
        const docIds = __tmNormalizeDocIdsForGroupInput(docIdsInput);
        if (!docIds.length) {
            hint('⚠ 未找到当前文档', 'warning');
            return;
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) {
            hint('⚠ 请先在任务管理器中创建文档分组', 'warning');
            return;
        }

        const currentGroupId = String(SettingsStore.data.currentGroupId || '').trim();
        const defaultGroupId = groups.some((item) => String(item?.id || '').trim() === currentGroupId)
            ? currentGroupId
            : String(groups[0]?.id || '').trim();
        const selectOptions = groups.map((group) => ({
            value: String(group?.id || '').trim(),
            label: __tmResolveDocGroupName(group)
        })).filter((item) => item.value);
        if (!selectOptions.length) {
            hint('⚠ 当前没有可用的文档分组', 'warning');
            return;
        }

        let title = '添加到任务管理器分组';
        if (docIds.length > 1) {
            title = `添加 ${docIds.length} 个文档到任务管理器分组`;
        }

        const selectedGroupId = await showSelectPrompt(title, selectOptions, defaultGroupId);
        if (!selectedGroupId) return;

        const result = await __tmAddDocsToGroup(docIds, selectedGroupId, options);
        if (!result?.group || !result.added) return;

        const groupName = __tmResolveDocGroupName(result.group);
        if (result.existed > 0) {
            hint(`✅ 已添加 ${result.added} 个文档到“${groupName}”，${result.existed} 个已存在`, 'success');
            return;
        }
        hint(docIds.length > 1 ? `✅ 已将 ${result.added} 个文档添加到“${groupName}”` : `✅ 已添加到分组“${groupName}”`, 'success');
    };

    window.tmOpenAddOtherBlocksToGroupDialog = async function(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) {
            hint('⚠ 未找到当前块', 'warning');
            return;
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) {
            hint('⚠ 请先在任务管理器中创建文档分组', 'warning');
            return;
        }

        const currentGroupId = __tmResolveOtherBlockGroupId();
        const defaultGroupId = groups.some((item) => String(item?.id || '').trim() === currentGroupId)
            ? currentGroupId
            : String(groups[0]?.id || '').trim();
        const selectOptions = groups.map((group) => ({
            value: String(group?.id || '').trim(),
            label: __tmResolveDocGroupName(group)
        })).filter((item) => item.value);
        if (!selectOptions.length) {
            hint('⚠ 当前没有可用的文档分组', 'warning');
            return;
        }

        const title = blockIds.length > 1 ? `添加 ${blockIds.length} 个块到其他块页签` : '添加到其他块页签';
        const selectedGroupId = await showSelectPrompt(title, selectOptions, defaultGroupId);
        if (!selectedGroupId) return;

        const result = await __tmAddOtherBlocksToCollection(blockIds, selectedGroupId, options);
        if (!result?.group || !result.added) return;

        const groupName = __tmResolveDocGroupName(result.group);
        if (result.existed > 0) {
            hint(blockIds.length > 1
                ? `✅ 已添加 ${result.added} 个块到“${groupName}”，${result.existed} 个已存在`
                : `✅ 已添加到“${groupName}”，该分组中已有 ${result.existed} 个重复块`, 'success');
            return;
        }
        hint(blockIds.length > 1 ? `✅ 已将 ${result.added} 个块添加到“${groupName}”` : `✅ 已添加到“${groupName}”`, 'success');
    };

    window.tmAutoAddOtherBlocksToCurrentGroup = async function(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) return { added: 0, existed: 0, invalid: 0, group: null, reason: 'empty' };
        const targetGroupId = __tmResolveAutoOtherBlockTargetGroupId(options?.groupId);
        if (!targetGroupId) {
            return { added: 0, existed: 0, invalid: 0, group: null, reason: 'no-group' };
        }
        return await __tmAddOtherBlocksToCollection(blockIds, targetGroupId, {
            ...options,
            silent: options?.silent !== false,
            forceRefresh: options?.forceRefresh !== false,
        });
    };

    window.tmAutoAddOtherBlocksToSourceDocGroup = async function(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) return { added: 0, existed: 0, invalid: 0, group: null, reason: 'empty' };
        const docId = await __tmResolveOtherBlockSourceDocId(blockIds, options);
        const target = await __tmEnsureSourceDocGroupForAction(docId, {
            title: '选择文档分组',
            forceRefresh: options?.forceRefresh !== false,
        });
        const targetGroupId = String(target?.groupId || '').trim();
        if (!targetGroupId) {
            return { added: 0, existed: 0, invalid: 0, group: null, reason: target?.reason || 'no-source-group', docId };
        }
        return await __tmAddOtherBlocksToCollection(blockIds, targetGroupId, {
            ...options,
            silent: options?.silent !== false,
            forceRefresh: options?.forceRefresh !== false,
        });
    };

    // 根据ID获取文档元数据
    async function fetchDocMeta(docId) {
        try {
            const sql = `SELECT content, hpath, ial FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1`;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const row = res.data[0] || {};
                return {
                    name: row.content || '未命名文档',
                    icon: __tmNormalizeDocIconValue(__tmReadIalAttrValue(row.ial, 'icon'))
                };
            }
        } catch (e) {
        }
        return null;
    }

    // 根据索引移除文档
    window.removeDocByIndex = async function(index) {
        await SettingsStore.removeDocId(index);
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    // 清空所有文档
    window.clearAllDocs = async function() {
        if (!confirm('确定要清空所有已选文档吗？')) return;
        await SettingsStore.clearDocIds();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    window.updateQueryLimit = async function(value) {
        state.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
        SettingsStore.data.queryLimit = state.queryLimit;
        await SettingsStore.save();
    };

    window.updateRecursiveDocLimit = async function(value) {
        state.recursiveDocLimit = parseInt(value) || 2000;
        SettingsStore.data.recursiveDocLimit = state.recursiveDocLimit;
        await SettingsStore.save();
    };

    window.updateLegacyWin7CompatMode = async function(enabled) {
        SettingsStore.data.legacyWin7CompatMode = !!enabled;
        try { __tmDocExpandCache?.clear?.(); } catch (e) {}
        try { window.__tmInvalidateDocScopeCache?.(); } catch (e) {}
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try {
                await loadSelectedDocuments({ forceFreshTasks: true, source: 'legacy-win7-compat-mode' });
            } catch (e) {}
        }
    };

    window.updateTaskParentLookupDepth = async function(value) {
        SettingsStore.data.taskParentLookupDepth = __tmNormalizeTaskParentLookupDepth(value);
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try {
                await loadSelectedDocuments({ source: 'task-parent-lookup-depth' });
            } catch (e) {}
        }
    };

    window.updateCurrentGroupCalendarSearchOptimizationEnabled = async function(enabled) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === currentGroupId);
        if (!group) return;
        const current = __tmGetGroupCalendarSearchOptimization(group);
        group.calendarSearchOptimization = {
            ...current,
            enabled: !!enabled
        };
        SettingsStore.data.docGroups = groups.map((item) => __tmNormalizeDocGroupConfig(item, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
        __tmCalendarDocWindowCache.clear();
        await SettingsStore.save();
        try {
            await loadSelectedDocuments();
            render();
        } catch (e) {}
        showSettings();
    };

    window.updateCurrentGroupCalendarSearchOptimizationDays = async function(value) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === currentGroupId);
        if (!group) return;
        const current = __tmGetGroupCalendarSearchOptimization(group);
        group.calendarSearchOptimization = {
            ...current,
            days: [7, 30, 60, 90, 120].includes(Number(value)) ? Number(value) : 90
        };
        SettingsStore.data.docGroups = groups.map((item) => __tmNormalizeDocGroupConfig(item, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
        __tmCalendarDocWindowCache.clear();
        await SettingsStore.save();
        try {
            await loadSelectedDocuments();
            render();
        } catch (e) {}
        showSettings();
    };

    window.updateEnableQuickbar = async function(enabled) {
        SettingsStore.data.enableQuickbar = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarToggle?.(!!enabled); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateEnableQuickbarInlineMeta = async function(enabled) {
        SettingsStore.data.enableQuickbarInlineMeta = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateTaskDoneDelightEnabled = async function(enabled) {
        SettingsStore.data.taskDoneDelightEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateTaskCheckboxCircleStyleEnabled = async function(enabled) {
        const next = !!enabled;
        SettingsStore.data.taskCheckboxCircleStyleEnabled = next;
        await SettingsStore.save();
        try { state.modal?.classList?.toggle('tm-modal--task-checkbox-circle', next); } catch (e) {}
        try { document.querySelectorAll('.tm-task-detail-shell').forEach(el => el.classList?.toggle?.('tm-task-detail--task-checkbox-circle', next)); } catch (e) {}
        try { document.getElementById('tm-task-detail-overlay')?.classList?.toggle('tm-task-detail--task-checkbox-circle', next); } catch (e) {}
        showSettings();
    };

    function __tmNormalizeQuickbarSettingItems(items, allow, fallbackItems) {
        const source = Array.isArray(items) ? items : fallbackItems;
        const seen = new Set();
        return source.map((v) => {
            const rawKey = String(v || '').trim();
            const customFieldId = __tmParseCustomFieldColumnKey(rawKey);
            return customFieldId ? `customField:${customFieldId}` : rawKey;
        }).filter((v) => {
            if ((!allow.has(v) && !__tmParseCustomFieldColumnKey(v)) || seen.has(v)) return false;
            seen.add(v);
            return true;
        });
    }

    function __tmSetQuickbarSettingItemEnabled(items, key, enabled, allow, fallbackItems, insertAfterKey = '') {
        const normalized = __tmNormalizeQuickbarSettingItems(items, allow, fallbackItems);
        const next = normalized.filter((item) => item !== key);
        if (enabled) {
            const insertIndex = insertAfterKey ? next.indexOf(insertAfterKey) : -1;
            if (insertIndex >= 0) next.splice(insertIndex + 1, 0, key);
            else next.push(key);
        }
        return next;
    }

    window.updateQuickbarInlineField = async function(field, enabled) {
        const allow = new Set(['custom-status', 'custom-completion-time', 'taskCompleteAt', 'subtask-count', 'custom-priority', 'custom-start-date', 'custom-focus-summary', 'custom-tomato-estimate-count', 'custom-tomato-count', 'custom-remark']);
        const rawKey0 = String(field || '').trim();
        const rawKey = rawKey0 === 'custom-duration' ? 'custom-focus-summary' : rawKey0;
        const customFieldId = __tmParseCustomFieldColumnKey(rawKey);
        const key = customFieldId ? `customField:${customFieldId}` : rawKey;
        if (!allow.has(key) && !customFieldId) return;
        const prev = Array.isArray(SettingsStore.data.quickbarInlineFields) ? SettingsStore.data.quickbarInlineFields : ['custom-status', 'custom-completion-time'];
        const next = __tmSetQuickbarSettingItemEnabled(prev, key, !!enabled, allow, ['custom-status', 'custom-completion-time'], key === 'taskCompleteAt' ? 'custom-completion-time' : '');
        if (!next.length) next.push('custom-status');
        SettingsStore.data.quickbarInlineFields = next;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateQuickbarVisibleItem = async function(field, enabled) {
        const allow = new Set(['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'taskCompleteAt', 'custom-focus-summary', 'custom-tomato-estimate-count', 'custom-tomato-count', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more']);
        const rawKey0 = String(field || '').trim();
        const rawKey = rawKey0 === 'custom-duration' ? 'custom-focus-summary' : rawKey0;
        const customFieldId = __tmParseCustomFieldColumnKey(rawKey);
        const key = customFieldId ? `customField:${customFieldId}` : rawKey;
        if (!allow.has(key) && !customFieldId) return;
        const defaults = ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-focus-summary', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more'];
        const prev = Array.isArray(SettingsStore.data.quickbarVisibleItems) ? SettingsStore.data.quickbarVisibleItems : defaults;
        SettingsStore.data.quickbarVisibleItems = __tmSetQuickbarSettingItemEnabled(prev, key, !!enabled, allow, defaults, key === 'taskCompleteAt' ? 'custom-completion-time' : '');
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
        showSettings();
    };

    window.updateQuickbarInlineShowOnMobile = async function(enabled) {
        SettingsStore.data.quickbarInlineShowOnMobile = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateQuickbarSubtaskCountUnfinishedOnly = async function(enabled) {
        SettingsStore.data.quickbarSubtaskCountUnfinishedOnly = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateEnableTomatoIntegration = async function(enabled) {
        SettingsStore.data.enableTomatoIntegration = !!enabled;
        await SettingsStore.save();
        if (!enabled) state.timerFocusTaskId = '';
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { render(); } catch (e) {}
        }
    };

    window.updateEnablePointsRewardIntegration = async function(enabled) {
        SettingsStore.data.enablePointsRewardIntegration = !!enabled;
        await SettingsStore.save();
        try { globalThis.__tmPointsPenaltyRuntimeRefresh?.({ reason: 'points-reward-integration-toggle' }); } catch (e) {}
        showSettings();
    };

    window.updatePointsRewardExcludedGroup = async function(groupId, excluded) {
        const gid = String(groupId || '').trim();
        if (!gid) return;
        const validGroupIds = new Set((Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
            .map((group) => String(group?.id || '').trim())
            .filter(Boolean));
        if (!validGroupIds.has(gid)) return;
        const current = new Set((Array.isArray(SettingsStore.data.pointsRewardExcludedGroupIds) ? SettingsStore.data.pointsRewardExcludedGroupIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && validGroupIds.has(id)));
        if (excluded) current.add(gid);
        else current.delete(gid);
        SettingsStore.data.pointsRewardExcludedGroupIds = Array.from(current);
        await SettingsStore.save();
        if (excluded && typeof resolveDocIdsFromGroups === 'function') {
            try {
                void resolveDocIdsFromGroups({
                    groupId: gid,
                    includeQuickAddDoc: false,
                    skipPersistedScope: true,
                    forceRefreshScope: true,
                });
            } catch (e) {}
        }
        showSettings();
    };

    window.updateEnablePointsPenaltyIntegration = async function(enabled) {
        SettingsStore.data.enablePointsPenaltyIntegration = !!enabled;
        await SettingsStore.save();
        try { globalThis.__tmPointsPenaltyRuntimeRefresh?.({ reason: 'points-penalty-toggle' }); } catch (e) {}
        showSettings();
    };

    window.updatePointsPenaltyScheduleEnabled = async function(enabled) {
        SettingsStore.data.pointsPenaltyScheduleEnabled = !!enabled;
        await SettingsStore.save();
        try { globalThis.__tmPointsPenaltyRuntimeRefresh?.({ reason: 'points-penalty-schedule-toggle' }); } catch (e) {}
        showSettings();
    };

    window.updatePointsPenaltyDeadlineEnabled = async function(enabled) {
        SettingsStore.data.pointsPenaltyDeadlineEnabled = !!enabled;
        await SettingsStore.save();
        try { globalThis.__tmPointsPenaltyRuntimeRefresh?.({ reason: 'points-penalty-deadline-toggle' }); } catch (e) {}
        showSettings();
    };

    window.updatePointsPenaltyScheduleAmount = async function(value) {
        const amount = Number(value);
        SettingsStore.data.pointsPenaltyScheduleAmount = Number.isFinite(amount) ? Math.max(0, Math.min(9999, Math.round(amount))) : 0;
        await SettingsStore.save();
        showSettings();
    };

    window.updatePointsPenaltyDeadlineAmount = async function(value) {
        const amount = Number(value);
        SettingsStore.data.pointsPenaltyDeadlineAmount = Number.isFinite(amount) ? Math.max(0, Math.min(9999, Math.round(amount))) : 0;
        await SettingsStore.save();
        showSettings();
    };

    window.updatePointsPenaltyCheckTimes = async function(value) {
        const lines = String(value || '').split(/\r?\n/);
        const seen = new Set();
        const out = [];
        const parseLine = (input) => {
            const text = String(input || '').trim();
            if (!text) return null;
            let dayOffset = 0;
            let hh = NaN;
            let mm = NaN;
            let hasOffset = false;
            let m = /^\+(\d+)\s+(\d{1,2}):(\d{2})$/.exec(text);
            if (m) {
                hasOffset = true;
                dayOffset = Number(m[1]);
                hh = Number(m[2]);
                mm = Number(m[3]);
            } else {
                m = /^(\d{1,2}):(\d{2})$/.exec(text);
                if (!m) return null;
                hh = Number(m[1]);
                mm = Number(m[2]);
            }
            if (!Number.isInteger(dayOffset)) return null;
            if (hasOffset && (dayOffset < 1 || dayOffset > 7)) return null;
            if (!hasOffset) dayOffset = 0;
            if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
            const timeText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            return {
                dayOffset,
                minute: hh * 60 + mm,
                normalized: dayOffset > 0 ? `+${dayOffset} ${timeText}` : timeText,
            };
        };
        lines.forEach((line) => {
            const parsed = parseLine(line);
            if (!parsed) return;
            if (seen.has(parsed.normalized)) return;
            seen.add(parsed.normalized);
            out.push(parsed);
        });
        out.sort((a, b) => {
            if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
            if (a.minute !== b.minute) return a.minute - b.minute;
            return a.normalized.localeCompare(b.normalized);
        });
        SettingsStore.data.pointsPenaltyCheckTimes = out.length ? out.map((item) => item.normalized) : ['23:00', '+1 08:00'];
        await SettingsStore.save();
        try { globalThis.__tmPointsPenaltyRuntimeRefresh?.({ reason: 'points-penalty-check-times-updated' }); } catch (e) {}
        showSettings();
    };

    window.updatePointsPenaltyCheckOnStartup = async function(enabled) {
        SettingsStore.data.pointsPenaltyCheckOnStartup = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updatePointsPenaltyConfirmModalEnabled = async function(enabled) {
        SettingsStore.data.pointsPenaltyConfirmModalEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateTomatoSpentAttrMode = async function(mode) {
        const v = String(mode || '').trim();
        SettingsStore.data.tomatoSpentAttrMode = (v === 'hours') ? 'hours' : 'minutes';
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyMinutes = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyMinutes = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyHours = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyHours = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoCountAttrKey = async function(value) {
        SettingsStore.data.tomatoCountAttrKey = String(value || '').trim() || 'custom-tomato-count';
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoEstimateAttrKey = async function(value) {
        SettingsStore.data.tomatoEstimateAttrKey = String(value || '').trim() || 'custom-tomato-estimate-count';
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateShowCompletedTasks = async function(enabled) {
        __tmSetShowCompletedTasksInSettings(!!enabled, SettingsStore.data);
        await SettingsStore.save();
        state.showCompletedTasks = !!SettingsStore.data.showCompletedTasks;
        state.excludeCompletedTasks = !state.showCompletedTasks;
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { applyFilters(); } catch (e) {}
            try { if (!__tmRerenderCurrentViewInPlace(state.modal)) render(); } catch (e) { try { render(); } catch (e2) {} }
        }
    };

    window.updateExcludeCompletedTasks = async function(enabled) {
        return window.updateShowCompletedTasks?.(!enabled);
    };

    window.updateSemanticDateAutoPromptEnabled = async function(enabled) {
        SettingsStore.data.semanticDateAutoPromptEnabled = !!enabled;
        await SettingsStore.save();
        if (!enabled) {
            try { __tmCloseSemanticDateConfirmModal(); } catch (e) {}
        }
        showSettings();
    };

    window.updateDefaultViewMode = async function(mode) {
        const next = __tmGetSafeViewMode(mode);
        SettingsStore.data.defaultViewMode = next;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('desktop-default-view');
        showSettings();
    };

    window.updateDefaultViewModeMobile = async function(mode) {
        const next = __tmGetSafeViewMode(mode);
        SettingsStore.data.defaultViewModeMobile = next;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('mobile-default-view');
        showSettings();
    };

    window.updateDockSidebarEnabled = async function(enabled) {
        SettingsStore.data.dockSidebarEnabled = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-enabled');
        showSettings();
    };

    window.updateDockDefaultViewMode = async function(mode) {
        const next = String(mode || '').trim();
        SettingsStore.data.dockDefaultViewMode = (next === 'follow-mobile' || __TM_ALL_VIEWS.some(v => v.id === next))
            ? next
            : 'follow-mobile';
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-default-view');
        showSettings();
    };

    window.updateDockChecklistCompactTitleJump = async function(enabled) {
        SettingsStore.data.dockChecklistCompactTitleJump = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-checklist-compact-title-jump');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('dock-checklist-compact-title-jump');
        }
    };

    window.updateMobileChecklistCompactTitleJump = async function(enabled) {
        SettingsStore.data.mobileChecklistCompactTitleJump = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('mobile-checklist-compact-title-jump');
        }
    };

    window.updateChecklistCompactMetaFieldVisibility = async function(scope, fieldKey, enabled) {
        const rawScope = String(scope || '').trim();
        const scopeKey = rawScope === 'dock'
            ? 'dock'
            : (rawScope === 'desktop' ? 'desktop' : 'mobile');
        const normalizedField = String(fieldKey || '').trim();
        const customFieldId = __tmParseCustomFieldColumnKey(normalizedField);
        const compactFieldKey = customFieldId ? `customField:${customFieldId}` : normalizedField;
        if (!__TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.some((item) => item.key === compactFieldKey) && !customFieldId) return;
        const settingsKey = scopeKey === 'dock'
            ? 'dockChecklistCompactMetaFields'
            : (scopeKey === 'desktop' ? 'desktopChecklistCompactMetaFields' : 'mobileChecklistCompactMetaFields');
        const current = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data[settingsKey]));
        if (enabled) current.add(compactFieldKey);
        else current.delete(compactFieldKey);
        SettingsStore.data[settingsKey] = __tmNormalizeCompactChecklistMetaFields(Array.from(current), []);
        if (scopeKey === 'dock') {
            SettingsStore.data.mobileChecklistCompactMetaFields = SettingsStore.data[settingsKey].slice();
        }
        await SettingsStore.save();
        if (scopeKey === 'dock') {
            __tmDispatchDockSettingsChanged('dock-checklist-compact-meta-fields');
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('checklist-compact-meta-fields');
        }
    };

    window.updateChecklistCompactRightFontSize = async function(value) {
        SettingsStore.data.checklistCompactRightFontSize = __tmNormalizeChecklistCompactRightFontSize(value);
        await SettingsStore.save();
        if (globalThis.__tmRuntimeHost?.isDesktopDockHost?.() ?? (__tmIsDockHost() && !__tmIsRuntimeMobileClient())) {
            __tmDispatchDockSettingsChanged('checklist-compact-right-font-size');
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('checklist-compact-right-font-size');
        }
    };

    window.updateTimelineCardFieldVisibility = async function(fieldKey, enabled) {
        const normalizedField = String(fieldKey || '').trim();
        if (!__TM_TIMELINE_CARD_FIELD_OPTIONS.some((item) => item.key === normalizedField)) return;
        const current = new Set(__tmNormalizeTimelineCardFields(SettingsStore.data.timelineCardFields));
        if (enabled) current.add(normalizedField);
        else current.delete(normalizedField);
        SettingsStore.data.timelineCardFields = __tmNormalizeTimelineCardFields(Array.from(current), []);
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('timeline-card-field-visibility');
        }
    };

    window.updateChecklistCompactTitleOpenDetailPage = async function(enabled) {
        SettingsStore.data.checklistCompactTitleOpenDetailPage = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('checklist-compact-title-open-detail-page');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('checklist-compact-title-open-detail-page');
        }
    };

    window.updateEnabledView = async function(mode, enabled) {
        const id = String(mode || '').trim();
        if (!__TM_ALL_VIEWS.some(v => v.id === id)) return;
        const current = __tmGetEnabledViews();
        let next = current.slice();
        if (enabled) {
            if (!next.includes(id)) next.push(id);
        } else {
            if (next.length <= 1) {
                try { hint('至少保留一个视图', 'warning'); } catch (e) {}
                showSettings();
                return;
            }
            next = next.filter(v => v !== id);
        }
        SettingsStore.data.enabledViews = __tmNormalizeEnabledViews(next);
        SettingsStore.data.defaultViewMode = __tmGetSafeViewMode(SettingsStore.data.defaultViewMode);
        state.viewMode = __tmGetSafeViewMode(state.viewMode);
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('enabled-views');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) render();
    };

    window.updateKanbanCompactMode = async function(enabled) {
        SettingsStore.data.kanbanCompactMode = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateChecklistCompactMode = async function(enabled) {
        SettingsStore.data.checklistCompactMode = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateChecklistCompactTreeGuides = async function(enabled) {
        SettingsStore.data.checklistCompactTreeGuides = !!enabled;
        SettingsStore.data.checklistCompactTreeGuidesUpdatedAt = Date.now();
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateKanbanColumnWidth = async function(width) {
        const n = Number(width);
        SettingsStore.data.kanbanColumnWidth = Number.isFinite(n) ? Math.max(220, Math.min(520, Math.round(n))) : 320;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateWhiteboardAllTabsCardMinWidth = async function(width) {
        const n = Number(width);
        SettingsStore.data.whiteboardAllTabsCardMinWidth = Number.isFinite(n) ? Math.max(220, Math.min(520, Math.round(n))) : 320;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('whiteboard-all-tabs-card-min-width');
        }
    };

    window.updateWhiteboardStreamMobileTwoColumns = async function(enabled) {
        SettingsStore.data.whiteboardStreamMobileTwoColumns = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            __tmScheduleSettingsViewRefresh('whiteboard-stream-mobile-two-columns');
        }
    };

    window.updateKanbanFillColumns = async function(enabled) {
        SettingsStore.data.kanbanFillColumns = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateKanbanShowDoneColumn = async function(enabled) {
        SettingsStore.data.kanbanShowDoneColumn = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateTaskCardFieldVisibility = async function(view, field, enabled) {
        const viewKey = String(view || '').trim() === 'whiteboard' ? 'whiteboardCardFields' : 'kanbanCardFields';
        const current = new Set(__tmNormalizeTaskCardFieldList(SettingsStore.data[viewKey], ['priority', 'status', 'date']));
        const key = String(field || '').trim();
        if (!key) return;
        if (enabled) current.add(key);
        else current.delete(key);
        SettingsStore.data[viewKey] = __tmNormalizeTaskCardFieldList(Array.from(current), ['priority', 'status', 'date']);
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateTaskCardAlwaysShowField = async function(field, enabled) {
        const current = new Set(__tmGetTaskCardAlwaysShowFieldList());
        const key = String(field || '').trim();
        if (!key) return;
        if (enabled) current.add(key);
        else current.delete(key);
        SettingsStore.data.taskCardAlwaysShowFields = __tmNormalizeTaskCardAlwaysShowFields(Array.from(current), ['priority', 'status', 'date']);
        SettingsStore.data.taskCardDateOnlyWithValue = !SettingsStore.data.taskCardAlwaysShowFields.includes('date');
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateTaskCardDateOnlyWithValue = async function(enabled) {
        const current = new Set(__tmGetTaskCardAlwaysShowFieldList());
        if (enabled) current.delete('date');
        else current.add('date');
        SettingsStore.data.taskCardAlwaysShowFields = __tmNormalizeTaskCardAlwaysShowFields(Array.from(current), ['priority', 'status', 'date']);
        SettingsStore.data.taskCardDateOnlyWithValue = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateDocH2SubgroupEnabled = async function(enabled) {
        SettingsStore.data.docH2SubgroupEnabled = !!enabled;
        await SettingsStore.save();
        if (enabled) {
            try { await __tmWarmKanbanDocHeadings(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateGroupByTaskName = async function(enabled) {
        SettingsStore.data.groupByTaskName = !!enabled;
        if (enabled) {
            SettingsStore.data.groupMode = 'task';
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupMode = 'none';
        }
        await SettingsStore.save();
        state.groupByDocName = SettingsStore.data.groupByDocName;
        state.groupByTaskName = SettingsStore.data.groupByTaskName;
        state.groupByTime = SettingsStore.data.groupByTime;
        state.quadrantEnabled = !!(SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.enabled);
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateDurationFormat = async function(format) {
        const v = String(format || '').trim();
        SettingsStore.data.durationFormat = (v === 'minutes') ? 'minutes' : 'hours';
        state.durationFormat = SettingsStore.data.durationFormat;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updatePinNewTasksByDefault = async function(enabled) {
        SettingsStore.data.pinNewTasksByDefault = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateSubtaskInheritedField = async function(field, enabled) {
        const rawKey = String(field || '').trim();
        const customFieldId = __tmParseCustomFieldColumnKey(rawKey);
        const key = customFieldId ? `customField:${customFieldId}` : rawKey;
        if (!__TM_SUBTASK_INHERIT_FIELD_OPTIONS.some((item) => item.key === key) && !customFieldId) return;
        const current = new Set(__tmNormalizeSubtaskInheritedFields(SettingsStore.data.subtaskInheritedFields, []));
        if (enabled) current.add(key);
        else current.delete(key);
        SettingsStore.data.subtaskInheritedFields = __tmNormalizeSubtaskInheritedFields(Array.from(current), []);
        await SettingsStore.save();
        showSettings();
    };

    window.updateEnableMoveBlockToDailyNote = async function(enabled) {
        SettingsStore.data.enableMoveBlockToDailyNote = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDailyNoteAppendToBottom = async function(enabled) {
        SettingsStore.data.newTaskDailyNoteAppendToBottom = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDailyNoteNotebookId = async function(value) {
        SettingsStore.data.newTaskDailyNoteNotebookId = String(value || '').trim();
        await SettingsStore.save();
        showSettings();
    };

    window.updateHeadingGroupCreateAtSectionEnd = async function(enabled) {
        SettingsStore.data.headingGroupCreateAtSectionEnd = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDocId = async function(value, options) {
        const v = String(value || '').trim();
        SettingsStore.data.newTaskDocId = v;
        await SettingsStore.save();
        const opt = (options && typeof options === 'object') ? options : {};
        if (opt.refreshQuickAdd !== false) {
            const qa = state.quickAdd;
            if (qa) {
                if (v === '__dailyNote__') {
                    qa.docMode = 'dailyNote';
                    qa.docId = qa.docId || __tmResolveDefaultDocId();
                } else {
                    qa.docMode = 'doc';
                    qa.docId = v || __tmResolveDefaultDocId();
                }
                try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
            }
        }
        if (opt.refreshPicker !== false) {
            if (state.quickAddDocPicker) {
                try { window.tmQuickAddOpenDocPicker?.(); } catch (e) {}
            }
        }
    };

    window.updateNewTaskDocIdFromSelect = async function(value) {
        await updateNewTaskDocId(value);
        try {
            const input = document.getElementById('tmNewTaskDocIdInput');
            const v = String(value || '').trim();
            if (input) input.value = v === '__dailyNote__' ? '' : v;
        } catch (e) {}
    };

    window.tmApplyNewTaskDocIdInput = async function() {
        const input = document.getElementById('tmNewTaskDocIdInput');
        const v = String(input?.value || '').trim();
        await updateNewTaskDocId(v);
        showSettings();
    };

    window.tmClearNewTaskDocIdInput = async function() {
        await updateNewTaskDocId('');
        showSettings();
    };

    window.updateDocTopbarButtonDesktop = async function(enabled) {
        SettingsStore.data.docTopbarButtonDesktop = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonMobile = async function(enabled) {
        SettingsStore.data.docTopbarButtonMobile = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonSwapPressActions = async function(enabled) {
        SettingsStore.data.docTopbarButtonSwapPressActions = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonLocateCurrentDocTab = async function(enabled) {
        SettingsStore.data.docTopbarButtonLocateCurrentDocTab = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateWindowTopbarIconDesktop = async function(enabled) {
        SettingsStore.data.windowTopbarIconDesktop = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonSyncWindowTopBar?.(); } catch (e) {}
        try { __tmRefreshShellEntrances(); } catch (e) {}
        showSettings();
    };

    window.updateWindowTopbarIconMobile = async function(enabled) {
        SettingsStore.data.windowTopbarIconMobile = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonSyncWindowTopBar?.(); } catch (e) {}
        try { __tmRefreshShellEntrances(); } catch (e) {}
        showSettings();
    };

    window.updateDefaultDocId = async function(value) {
        const v = String(value || '').trim();
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (groupId === 'all') {
            SettingsStore.data.defaultDocId = v;
        } else {
            const map = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
                ? { ...SettingsStore.data.defaultDocIdByGroup }
                : {};
            map[groupId] = v;
            SettingsStore.data.defaultDocIdByGroup = map;
        }
        await SettingsStore.save();
    };

    window.updateDefaultDocIdFromSelect = async function(value) {
        await updateDefaultDocId(value);
        try {
            const input = document.getElementById('tmDefaultDocIdInput');
            if (input) input.value = String(value || '').trim();
        } catch (e) {}
    };

    window.tmApplyDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        const v = String(input?.value || '').trim();
        await updateDefaultDocId(v);
        hint(v ? '✅ 默认文档ID已更新' : '✅ 默认文档已清空', 'success');
        showSettings();
    };

    window.tmClearDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        if (input) input.value = '';
        await updateDefaultDocId('');
        hint('✅ 默认文档已清空', 'success');
        showSettings();
    };

    function __tmRefreshSettingsProjectionView(reason = 'settings-projection') {
        const refreshReason = String(reason || 'settings-projection').trim() || 'settings-projection';
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: true,
                reason: refreshReason,
                bypassScrollDefer: true,
                bypassInteractionDefer: false,
                forceRebuild: true,
            });
            return;
        } catch (e) {}
        try {
            __tmScheduleRender({ withFilters: true, reason: refreshReason });
            return;
        } catch (e) {}
        try { applyFilters(); } catch (e) {}
        try {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        } catch (e) {
            try { render(); } catch (e2) {}
        }
    }

    function __tmScheduleSettingsViewRefresh(reason = 'settings-change', options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            __tmScheduleViewRefresh({
                mode: String(opts.mode || 'current').trim() || 'current',
                withFilters: opts.withFilters === true,
                reason: String(reason || 'settings-change').trim() || 'settings-change',
                bypassScrollDefer: opts.bypassScrollDefer !== false,
                bypassInteractionDefer: opts.bypassInteractionDefer === true,
                forceRebuild: opts.forceRebuild !== false,
            });
            return true;
        } catch (e) {}
        return false;
    }

    window.toggleGroupByTime = async function(checked) {
        state.groupByTime = !!checked;
        if (state.groupByTime) {
            // 开启按时间分组时，需要将其他分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = true;
            SettingsStore.data.groupMode = 'time';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            // 关闭分组模式时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'none';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        __tmRefreshSettingsProjectionView('settings-group-by-time');
    };

    window.toggleGroupByDocName = async function(checked) {
        state.groupByDocName = !!checked;
        if (state.groupByDocName) {
            // 开启按文档分组时，需要将其他分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupByDocName = true;
            SettingsStore.data.groupMode = 'doc';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            // 关闭分组模式时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'none';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        __tmRefreshSettingsProjectionView('settings-group-by-doc');
    };

    window.toggleGroupByTaskName = async function(checked) {
        state.groupByTaskName = !!checked;
        if (state.groupByTaskName) {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupByTaskName = true;
            SettingsStore.data.groupMode = 'task';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupByTaskName = false;
            SettingsStore.data.groupMode = 'none';
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        __tmRefreshSettingsProjectionView('settings-group-by-task');
    };

    window.toggleQuadrantGroup = async function(checked) {
        state.quadrantEnabled = !!checked;
        if (state.quadrantEnabled) {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'quadrant';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = true;
        } else {
            // 关闭四象限时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
            SettingsStore.data.groupMode = 'none';
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        __tmRefreshSettingsProjectionView('settings-group-quadrant');
    };

    window.tmSwitchGroupMode = async function(mode) {
        const m = String(mode || '').trim();
        if (m === 'doc') return toggleGroupByDocName(true);
        if (m === 'time') return toggleGroupByTime(true);
        if (m === 'task') return toggleGroupByTaskName(true);
        if (m === 'quadrant') return toggleQuadrantGroup(true);
        // 只修改当前视图状态，不修改设置开关
        state.groupByDocName = false;
        // 切换到不分组时，设置 state.groupByTaskName 为 false
        // 但不修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
        state.groupByTaskName = false;
        state.groupByTime = false;
        state.quadrantEnabled = false;
        SettingsStore.data.groupMode = 'none';
        SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
        SettingsStore.data.quadrantConfig.enabled = false;
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        __tmRefreshSettingsProjectionView('settings-group-none');
    };

    window.tmToggleKanbanHeadingGroupMode = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const next = __tmGetKanbanBoardMode() === 'heading' ? 'status' : 'heading';
        return window.tmSetKanbanBoardMode(next, ev);
    };

    window.tmSetKanbanBoardMode = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const prev = __tmGetKanbanBoardMode();
        const next = __tmNormalizeKanbanBoardMode(mode) || 'status';
        if (next === prev) return;
        __tmSetKanbanBoardModeState(next);
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (next === 'heading') {
            try { await __tmCleanupPlaceholderTasks(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
            try { await __tmWarmKanbanDocHeadings(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
        }
        __tmRefreshSettingsProjectionView('settings-kanban-board-mode');
        const labelMap = { status: '状态看板', heading: '标题看板', time: '时间看板' };
        try { hint(`✅ 已切换到${labelMap[next] || '状态看板'}`, 'success'); } catch (e) {}
    };

    window.tmSetKanbanHeadingGroupMode = async function(mode, ev) {
        const m = String(mode || '').trim().toLowerCase();
        return window.tmSetKanbanBoardMode(m === 'heading' ? 'heading' : 'status', ev);
    };

    window.tmSetWhiteboardAllTabsLayoutMode = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const next = __tmNormalizeWhiteboardAllTabsLayoutMode(mode);
        const prev = __tmGetWhiteboardAllTabsLayoutMode();
        if (next === prev) return;
        SettingsStore.data.whiteboardAllTabsLayoutMode = next;
        state.whiteboardAllTabsDocDragId = '';
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        render();
        try { hint(next === 'stream' ? '✅ 已切换到卡片流' : '✅ 已切换到白板', 'success'); } catch (e) {}
    };

    window.tmSetWhiteboardLayoutModeFromMobileMenu = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        if (String(state.viewMode || '').trim() !== 'whiteboard') return;
        const next = __tmNormalizeWhiteboardAllTabsLayoutMode(mode);
        const prev = __tmGetWhiteboardAllTabsLayoutMode();
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const needSwitchAllTabs = activeDocId !== 'all';
        if (!needSwitchAllTabs && next === prev) {
            try { window.tmHideMobileMenu?.(); } catch (e) {}
            return;
        }
        if (needSwitchAllTabs) {
            await window.tmSwitchDoc('all');
            if (next === prev) {
                try { hint(next === 'stream' ? '✅ 已切换到卡片流' : '✅ 已切换到白板', 'success'); } catch (e) {}
                try { window.tmHideMobileMenu?.(); } catch (e) {}
                return;
            }
        }
        await window.tmSetWhiteboardAllTabsLayoutMode(next, ev);
    };

    window.tmWhiteboardAllTabsDocDragStart = function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        const id = String(docId || '').trim();
        if (!id) return;
        state.whiteboardAllTabsDocDragId = id;
        try {
            if (ev?.dataTransfer) {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', id);
            }
        } catch (e) {}
        __tmClearWhiteboardAllTabsDocDragMarkers();
        try {
            const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
            card?.classList?.add?.('tm-whiteboard-stream-doc--dragging');
        } catch (e) {}
    };

    window.tmWhiteboardAllTabsDocDragEnd = function() {
        state.whiteboardAllTabsDocDragId = '';
        __tmClearWhiteboardAllTabsDocDragMarkers();
    };

    window.tmWhiteboardAllTabsDocDragOver = function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        const sourceId = String(state.whiteboardAllTabsDocDragId || '').trim();
        const targetId = String(docId || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) return;
        try { ev?.preventDefault?.(); } catch (e) {}
        try { if (ev?.dataTransfer) ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
        if (!(card instanceof HTMLElement)) return;
        const rect = card.getBoundingClientRect();
        const pos = (Number(ev?.clientY) - rect.top) > (rect.height / 2) ? 'after' : 'before';
        __tmClearWhiteboardAllTabsDocDragMarkers();
        card.classList.add(pos === 'after' ? 'tm-whiteboard-stream-doc--drag-after' : 'tm-whiteboard-stream-doc--drag-before');
        try {
            const sourceCard = state.modal?.querySelector?.(`.tm-whiteboard-stream-doc[data-doc-id="${CSS.escape(sourceId)}"]`);
            sourceCard?.classList?.add?.('tm-whiteboard-stream-doc--dragging');
        } catch (e) {}
    };

    window.tmWhiteboardAllTabsDocDrop = async function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const sourceId = String(state.whiteboardAllTabsDocDragId || '').trim()
            || String(ev?.dataTransfer?.getData?.('text/plain') || '').trim();
        const targetId = String(docId || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) {
            __tmClearWhiteboardAllTabsDocDragMarkers();
            return;
        }
        const visibleIds = Array.from(new Set((Array.isArray(state.whiteboardAllTabsVisibleDocIds) ? state.whiteboardAllTabsVisibleDocIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!visibleIds.includes(sourceId) || !visibleIds.includes(targetId)) {
            __tmClearWhiteboardAllTabsDocDragMarkers();
            return;
        }
        const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
        let insertAfter = false;
        if (card instanceof HTMLElement) {
            const rect = card.getBoundingClientRect();
            insertAfter = (Number(ev?.clientY) - rect.top) > (rect.height / 2);
        }
        const nextVisible = visibleIds.filter((id) => id !== sourceId);
        const targetIndex = nextVisible.indexOf(targetId);
        const insertIndex = targetIndex < 0 ? nextVisible.length : Math.max(0, Math.min(nextVisible.length, targetIndex + (insertAfter ? 1 : 0)));
        nextVisible.splice(insertIndex, 0, sourceId);
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const storedIds = Array.isArray(__tmGetWhiteboardAllTabsDocOrderByGroupMap()[groupId])
            ? __tmGetWhiteboardAllTabsDocOrderByGroupMap()[groupId]
            : [];
        const baseIds = Array.isArray(state.whiteboardAllTabsBaseDocIds) ? state.whiteboardAllTabsBaseDocIds : [];
        const remainder = [];
        const pushRemainder = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || nextVisible.includes(id) || remainder.includes(id)) return;
            remainder.push(id);
        };
        storedIds.forEach(pushRemainder);
        baseIds.forEach(pushRemainder);
        state.whiteboardAllTabsVisibleDocIds = nextVisible.slice();
        __tmSetWhiteboardAllTabsDocOrder(groupId, nextVisible.concat(remainder));
        state.whiteboardAllTabsDocDragId = '';
        __tmClearWhiteboardAllTabsDocDragMarkers();
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmToggleGroupCollapse = async function(groupKey, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const isChecklist = String(state.viewMode || '').trim() === 'checklist';
        const isCalendarSidebarChecklist = __tmHasCalendarSidebarChecklist(state.modal);

        const rawKey = String(groupKey || '').trim();
        const k0 = __tmNormalizeCompletedRootGroupKey(rawKey);
        if (!k0) return;
        try { __tmMarkHighPriorityInteraction('group-collapse-toggle', 680); } catch (e) {}
        const isCompletedGroup = __tmIsCompletedRootGroupKey(k0);
        const action = isCompletedGroup
            ? (__tmIsCompletedRootGroupCollapsed(k0) ? 'expand' : 'collapse')
            : (state.collapsedGroups.has(k0) ? 'expand' : 'collapse');
        const mode = __tmGetCollapseAnimMode();
        const flipOpts = { kind: 'group', key: k0, action, lite: mode === 'lite' };
        let skipAnim = mode === 'none';
        try {
            const tbody = __tmGetActiveTbody(state.modal);
            const n = __tmCountAffectedRowsForCollapse(tbody, flipOpts, 161);
            if (n > 240) skipAnim = true;
            else if (n > 120 && !skipAnim) flipOpts.lite = true;
        } catch (e) {}
        if (!skipAnim) {
            try { __tmPrepareFlipAnimation(flipOpts); } catch (e) {}
        } else {
            try { __tmResetFlipState(state.modal); } catch (e) {}
        }

        if (isCompletedGroup) {
            if (state.docTabsArchiveMode === true) {
                if (action === 'expand') state.collapsedGroups.delete(k0);
                else state.collapsedGroups.add(k0);
            } else {
                const expandedCompletedGroups = __tmGetExpandedCompletedGroupsSet();
                if (action === 'expand') expandedCompletedGroups.add(k0);
                else expandedCompletedGroups.delete(k0);
                state.collapsedGroups.delete(k0);
                __tmPersistExpandedCompletedGroups();
            }
        } else if (state.collapsedGroups.has(k0)) state.collapsedGroups.delete(k0);
        else state.collapsedGroups.add(k0);

        SettingsStore.data.collapsedGroups = [...state.collapsedGroups];
        __tmMarkCollapseStateChanged();
        // 直接同步到本地存储，不等待云端同步，避免延迟
        try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        const persistCollapsedGroups = () => {
            try {
                const p = SettingsStore.save();
                if (p && typeof p.catch === 'function') p.catch(() => null);
            } catch (e) {}
        };
        if (isChecklist) {
            persistCollapsedGroups();
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (isCalendarSidebarChecklist) {
            persistCollapsedGroups();
            __tmRefreshCalendarSidebarChecklistPreserveScroll();
            return;
        }
        try { __tmUpdateToggleGlyphInDom({ kind: 'group', key: k0, action }); } catch (e) {}
        if (action === 'collapse') {
            if (state.modal && __tmApplyVisibilityFromState(state.modal)) {
                persistCollapsedGroups();
                if (!skipAnim) {
                    try { queueMicrotask(() => { try { __tmRunFlipAnimation(state.modal); } catch (e) {} }); } catch (e) {}
                }
                return;
            }
            persistCollapsedGroups();
            __tmScheduleCollapseRerender();
            return;
        }
        persistCollapsedGroups();
        __tmScheduleCollapseRerender();
    };

    window.tmToggleCollapse = async function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const isChecklist = String(state.viewMode || '').trim() === 'checklist';
        const isCalendarSidebarChecklist = __tmHasCalendarSidebarChecklist(state.modal);
        const isListView = String(state.viewMode || '').trim() === 'list';
        const key = String(id || '');
        if (!key) return;

        const action = state.collapsedTaskIds.has(key) ? 'expand' : 'collapse';
        const useFastListCollapse = !isChecklist && isListView && action === 'collapse';
        const mode = useFastListCollapse ? 'none' : __tmGetCollapseAnimMode();
        const flipOpts = { kind: 'task', key, action, lite: mode === 'lite' };
        let skipAnim = mode === 'none' || useFastListCollapse;
        if (!useFastListCollapse) {
            try {
                const tbody = __tmGetActiveTbody(state.modal);
                const n = __tmCountAffectedRowsForCollapse(tbody, flipOpts, 161);
                if (n > 240) skipAnim = true;
                else if (n > 120 && !skipAnim) flipOpts.lite = true;
            } catch (e) {}
        }
        if (!skipAnim) {
            try { __tmPrepareFlipAnimation(flipOpts); } catch (e) {}
        } else {
            try { __tmResetFlipState(state.modal); } catch (e) {}
        }
        if (state.collapsedTaskIds.has(key)) state.collapsedTaskIds.delete(key);
        else state.collapsedTaskIds.add(key);

        // 直接同步到本地存储，不等待云端同步，避免延迟
        SettingsStore.data.collapsedTaskIds = [...state.collapsedTaskIds];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
        const persistCollapsedTasks = () => {
            try {
                const p = SettingsStore.save();
                if (p && typeof p.catch === 'function') p.catch(() => null);
            } catch (e) {}
        };
        if (isChecklist) {
            persistCollapsedTasks();
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (isCalendarSidebarChecklist) {
            persistCollapsedTasks();
            __tmRefreshCalendarSidebarChecklistPreserveScroll();
            return;
        }
        try { __tmUpdateToggleGlyphInDom({ kind: 'task', key, action }); } catch (e) {}
        if (action === 'collapse') {
            if (useFastListCollapse && state.modal && __tmTryCollapseTaskBranchInList(state.modal, key)) {
                persistCollapsedTasks();
                return;
            }
            if (state.modal && __tmApplyVisibilityFromState(state.modal)) {
                persistCollapsedTasks();
                if (!skipAnim) {
                    try { queueMicrotask(() => { try { __tmRunFlipAnimation(state.modal); } catch (e) {} }); } catch (e) {}
                }
                return;
            }
            persistCollapsedTasks();
            __tmScheduleCollapseRerender();
            return;
        }
        persistCollapsedTasks();
        __tmScheduleCollapseRerender();
    };

    function __tmCollectVisibleGroupKeysFromDom() {
        const modal = state.modal;
        if (!(modal instanceof HTMLElement)) return [];
        const keys = new Set();
        modal.querySelectorAll?.('[data-group-key]').forEach((el) => {
            const key = String(el?.getAttribute?.('data-group-key') || '').trim();
            if (key) keys.add(key);
        });
        return Array.from(keys);
    }

    function __tmCollapseAllVisibleGroupsIfEnabled() {
        if (!SettingsStore.data.collapseAllIncludesGroups) return false;
        const nextGroups = new Set(state.collapsedGroups || []);
        const expandedCompletedGroups = __tmGetExpandedCompletedGroupsSet();
        __tmCollectVisibleGroupKeysFromDom().forEach((key) => {
            if (__tmIsCompletedRootGroupKey(key)) {
                const normalizedKey = __tmNormalizeCompletedRootGroupKey(key);
                expandedCompletedGroups.delete(normalizedKey);
                if (state.docTabsArchiveMode === true) nextGroups.add(normalizedKey);
                else nextGroups.delete(normalizedKey);
                return;
            }
            nextGroups.add(key);
        });
        state.collapsedGroups = nextGroups;
        SettingsStore.data.collapsedGroups = [...nextGroups];
        __tmPersistExpandedCompletedGroups();
        try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        return true;
    }

    function __tmExpandAllVisibleGroupsIfEnabled() {
        if (!SettingsStore.data.collapseAllIncludesGroups) return false;
        const visibleGroupKeys = new Set(__tmCollectVisibleGroupKeysFromDom());
        const expandedCompletedGroups = __tmGetExpandedCompletedGroupsSet();
        visibleGroupKeys.forEach((key) => {
            if (__tmIsCompletedRootGroupKey(key)) expandedCompletedGroups.add(__tmNormalizeCompletedRootGroupKey(key));
        });
        const nextGroups = new Set(Array.from(state.collapsedGroups || []).filter((key) => !visibleGroupKeys.has(String(key || '').trim())));
        state.collapsedGroups = nextGroups;
        SettingsStore.data.collapsedGroups = [...nextGroups];
        __tmPersistExpandedCompletedGroups();
        try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        return true;
    }

    window.tmCollapseAllTasks = async function() {
        if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard') {
            const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            const collapsed = __tmKanbanGetCollapsedSet();
            filtered.forEach(t => {
                const id = String(t?.id || '').trim();
                if (!id) return;
                const kids = Array.isArray(t?.children) ? t.children : [];
                if (!kids.length) return;
                // 子任务可能因为已完成列等原因不在同列显示，但父任务仍应纳入“全部折叠”。
                collapsed.add(id);
            });
            __tmCollapseAllVisibleGroupsIfEnabled();
            __tmKanbanPersistCollapsed();
            render();
            return;
        }
        const filteredSet = new Set(state.filteredTasks.map(t => t.id));
        const next = new Set(state.collapsedTaskIds || []);
        const applyCollapse = (list) => {
            list.forEach(t => {
                const hasVisibleChild = (t.children || []).some(c => filteredSet.has(c.id));
                if (filteredSet.has(t.id) && hasVisibleChild) {
                    next.add(String(t.id));
                }
                if (t.children && t.children.length > 0) applyCollapse(t.children);
            });
        };
        state.taskTree.forEach(doc => {
            if (state.activeDocId !== 'all' && doc.id !== state.activeDocId) return;
            applyCollapse(doc.tasks || []);
        });
        state.collapsedTaskIds = next;
        SettingsStore.data.collapsedTaskIds = [...next];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
        __tmCollapseAllVisibleGroupsIfEnabled();
        try { __tmResetFlipState(state.modal); } catch (e) {}
        if (!(state.modal && __tmApplyVisibilityFromState(state.modal))) {
            if (!__tmRerenderCollapseInPlace()) render();
        }
        await SettingsStore.save();
    };

    window.tmExpandAllTasks = async function() {
        if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard') {
            __tmKanbanGetCollapsedSet().clear();
            __tmExpandAllVisibleGroupsIfEnabled();
            __tmKanbanPersistCollapsed();
            render();
            return;
        }
        state.collapsedTaskIds = new Set();
        SettingsStore.data.collapsedTaskIds = [];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', []); } catch (e) {}
        __tmExpandAllVisibleGroupsIfEnabled();
        try { __tmResetFlipState(state.modal); } catch (e) {}
        if (!__tmRerenderCollapseInPlace()) render();
        await SettingsStore.save();
    };

    window.closeSettings = function() {
        state.__settingsUnstack?.();
        state.__settingsUnstack = null;
        state.statusOptionDraft = null;
        state.statusOptionDraftShouldFocus = false;
        state.settingsSearchQuery = '';
        state.settingsSearchResultsOpen = false;
        state.settingsSearchActiveIndex = -1;
        state.settingsSearchPendingTarget = null;
        try {
            if (state.settingsSearchHighlightTimer) clearTimeout(state.settingsSearchHighlightTimer);
        } catch (e) {}
        state.settingsSearchHighlightTimer = null;
        if (state.settingsModal) {
            state.settingsModal.remove();
            state.settingsModal = null;
        }
        state.settingsSectionJump = null;
    };

