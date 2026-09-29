# -*- coding: utf-8 -*-
# 插件落地：文档分组管理按 v3 原型重设计
# JS(60-settings-screen.js)：路径副标题 / 三页签->单页分节(双折叠) / 头部操作分层
# CSS(task-horizon.css)：source-path 样式 / 操作 hover 浮现 / 幽灵移除按钮 / fold 样式 / 删 tabs
import io

ROOT = r'D:\AI\trae\siyuan-plugin-task-horizon'

def load(path):
    s = io.open(path, encoding='utf-8', newline='').read()
    return s.replace('\r\n', '\n')

def save(path, s):
    io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))

# ============================ JS ============================
JP = ROOT + r'\src\task-horizon\main\settings\60-settings-screen.js'
js = load(JP)

def jrep(old, new, tag):
    global js
    n = js.count(old)
    assert n == 1, f'JS {tag}: 命中 {n} 次'
    js = js.replace(old, new)
    print('ok js:', tag)

# ---- 1. 路径解析 helper（resolveDocName 之后）----
jrep("""            return doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : '未知文档';
        };
""",
"""            return doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : '未知文档';
        };
        /* 来源行副标题：优先显示父路径（同名文档可区分），ID 收进 title */
        const resolveDocPathLabel = (docId, doc = null) => {
            const id = String(docId || '').trim();
            if (!id) return { text: '', title: '' };
            const target = doc || state.allDocuments.find((item) => String(item?.id || '').trim() === id) || null;
            const rawPath = String(target?.hpath || target?.path || '').trim();
            const segs = rawPath.replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
            if (segs.length > 1) segs.pop();
            let text = segs.join(' › ');
            if (!text && target) {
                const notebookId = String(target?.notebook || target?.box || '').trim();
                if (notebookId) text = __tmGetNotebookDisplayName(notebookId, '');
            }
            if (!text) text = id;
            const title = rawPath ? `${rawPath} · 文档 ID ${id}` : `文档 ID ${id}`;
            return { text, title };
        };
""",
    'helper resolveDocPathLabel')

# ---- 2. 删 detailTabs / activeDetailTab ----
jrep("""            const detailTabs = isAllDocs ? ['sources', 'excluded'] : ['sources', 'excluded', 'optimization'];
            const requestedDetailTab = String(state.settingsDocGroupDetailTab || 'sources').trim();
            const activeDetailTab = detailTabs.includes(requestedDetailTab) ? requestedDetailTab : 'sources';
""", '', 'detailTabs')

# ---- 3. renderSourceRows：pathLabel 计算 ----
jrep("""                            const docName = isNotebook
                                ? __tmGetNotebookDisplayName(docId, '未知笔记本')
                                : (doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : (fallbackOtherBlockDocName || '未知文档'));
""",
"""                            const docName = isNotebook
                                ? __tmGetNotebookDisplayName(docId, '未知笔记本')
                                : (doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : (fallbackOtherBlockDocName || '未知文档'));
                            const pathLabel = isNotebook ? { text: '', title: '' } : resolveDocPathLabel(docId, doc);
""",
    'pathLabel calc')

# ---- 4. renderSourceRows：meta 的 ID -> 路径 ----
jrep("""                                        <div class="tm-doc-group-manager__source-meta">
                                            <span class="tm-doc-group-manager__source-id" title="${esc(docId)}">${esc(docId)}</span>
""",
"""                                        <div class="tm-doc-group-manager__source-meta">
                                            ${isNotebook ? '' : `<span class="tm-doc-group-manager__source-path" title="${esc(pathLabel.title)}">${esc(pathLabel.text)}</span>`}
""",
    'source meta path')

# ---- 5. renderExcludedPane：回调加路径 + 行模板 + restore 包进 actions ----
jrep("""                            const docName = resolveDocName(docId);
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon('file-text', 15)}</span>
""",
"""                            const docName = resolveDocName(docId);
                            const excludedPathLabel = resolveDocPathLabel(docId);
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon('file-text', 15)}</span>
""",
    'excluded pathLabel')

jrep("""                                        <div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-id" title="${esc(String(docId))}">${esc(String(docId))}</span></div>
""",
"""                                        <div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-path" title="${esc(excludedPathLabel.title)}">${esc(excludedPathLabel.text)}</span></div>
""",
    'excluded meta path')

jrep("""                                    <button type="button" class="tm-doc-group-manager__restore" onclick="removeExcludedDocFromCurrentGroup('${escSq(docId)}')">恢复显示</button>
""",
"""                                    <div class="tm-doc-group-manager__source-actions"><button type="button" class="tm-doc-group-manager__restore" onclick="removeExcludedDocFromCurrentGroup('${escSq(docId)}')">恢复显示</button></div>
""",
    'restore wrap')

# ---- 6. renderSourcePane：custom 不再渲染 trigger-row（选择文档移头部）----
jrep("""                ` : `
                    <div class="tm-doc-group-manager__picker-trigger-row">
                        <button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__picker-trigger"
                            data-tm-action="tmOpenSettingsDocPicker">
                            <span>选择文档</span>
                        </button>
                    </div>
                `;
""",
"""                ` : '';
""",
    'picker trigger row removed')

# ---- 7. renderSourcePane：来源节加小标题 ----
jrep("""                return `${addForm}${renderSourceRows()}`;
""",
"""                return `<div class="tm-doc-group-manager__pane-label"><span>${isAllDocs ? '汇总所有分组的来源文档' : `${currentDocs.length} 项来源`}</span><small>任务从这些文档读取</small></div>${addForm}${renderSourceRows()}`;
""",
    'pane label')

# ---- 8. renderDetailActions：头部操作分层 ----
old_actions = """            const renderDetailActions = () => {
                if (isAllDocs) return '';
                const canRename = !isNotebookGroup;
                const canClear = isNotebookGroup || (Array.isArray(currentGroup?.docs) && currentGroup.docs.length > 0);
                return `
                    <div class="tm-doc-group-manager__detail-actions">
                        <button type="button" class="tm-doc-group-manager__icon-button"
                            data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([-1]))}'
                            title="${currentGroupIndex > 0 ? '上移分组' : '已是第一个分组'}" aria-label="上移分组"${currentGroupIndex > 0 ? '' : ' disabled'}>
                            ${icon('arrow-up', 15)}
                        </button>
                        <button type="button" class="tm-doc-group-manager__icon-button"
                            data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([1]))}'
                            title="${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? '下移分组' : '已是最后一个分组'}" aria-label="下移分组"${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? '' : ' disabled'}>
                            ${icon('arrow-down', 15)}
                        </button>
                        <button type="button" class="tm-btn tm-btn-secondary tm-doc-group-manager__export" data-tm-action="exportCurrentGroup">
                            ${icon('download', 15)}<span>导出</span>
                        </button>
                        <details class="tm-doc-group-manager__more">
                            <summary class="tm-doc-group-manager__icon-button" title="更多操作" aria-label="更多操作">${icon('dots-three', 17)}</summary>
                            <div class="tm-doc-group-manager__more-menu" role="menu">
                                ${canRename ? `<button type="button" data-tm-action="renameCurrentGroup" role="menuitem">${icon('pencil', 15)}<span>重命名</span></button>` : ''}
                                ${canClear ? `<button type="button" data-tm-action="clearCurrentGroupDocs" role="menuitem">${icon(isNotebookGroup ? 'archive' : 'trash-2', 15)}<span>${isNotebookGroup ? '解除笔记本关联' : '清空手动文档'}</span></button>` : ''}
                                <button type="button" class="is-danger" data-tm-action="deleteCurrentGroup" role="menuitem">${icon('trash-2', 15)}<span>删除分组</span></button>
                            </div>
                        </details>
                    </div>
                `;
            };
"""
new_actions = """            const renderDetailActions = () => {
                if (isAllDocs) return '';
                const canRename = !isNotebookGroup;
                const canClear = isNotebookGroup || (Array.isArray(currentGroup?.docs) && currentGroup.docs.length > 0);
                const canMoveUp = currentGroupIndex > 0;
                const canMoveDown = currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1;
                return `
                    <div class="tm-doc-group-manager__detail-actions">
                        ${!isNotebookGroup ? `<button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__picker-trigger" data-tm-action="tmOpenSettingsDocPicker">${icon('plus', 14)}<span>选择文档</span></button>` : ''}
                        <button type="button" class="tm-btn tm-btn-secondary tm-doc-group-manager__export" data-tm-action="exportCurrentGroup">
                            ${icon('download', 15)}<span>导出</span>
                        </button>
                        <details class="tm-doc-group-manager__more">
                            <summary class="tm-doc-group-manager__icon-button" title="更多操作" aria-label="更多操作">${icon('dots-three', 17)}</summary>
                            <div class="tm-doc-group-manager__more-menu" role="menu">
                                <button type="button" role="menuitem" data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([-1]))}'${canMoveUp ? '' : ' disabled'}>${icon('arrow-up', 15)}<span>上移分组</span></button>
                                <button type="button" role="menuitem" data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([1]))}'${canMoveDown ? '' : ' disabled'}>${icon('arrow-down', 15)}<span>下移分组</span></button>
                                ${canRename ? `<button type="button" data-tm-action="renameCurrentGroup" role="menuitem">${icon('pencil', 15)}<span>重命名</span></button>` : ''}
                                ${canClear ? `<button type="button" data-tm-action="clearCurrentGroupDocs" role="menuitem">${icon(isNotebookGroup ? 'archive' : 'trash-2', 15)}<span>${isNotebookGroup ? '解除笔记本关联' : '清空手动文档'}</span></button>` : ''}
                                <button type="button" class="is-danger" data-tm-action="deleteCurrentGroup" role="menuitem">${icon('trash-2', 15)}<span>删除分组</span></button>
                            </div>
                        </details>
                    </div>
                `;
            };
"""
jrep(old_actions, new_actions, 'renderDetailActions')

# ---- 9. 删 renderDetailTab + detailPaneHtml ----
old_tabfn = """            const renderDetailTab = (tab, label, count = null) => {
                const active = activeDetailTab === tab;
                return `
                    <button type="button" class="tm-doc-group-manager__tab${active ? ' is-active' : ''}"
                        data-tm-call="tmSetDocGroupSettingsDetailTab"
                        data-tm-args='${esc(JSON.stringify([tab]))}'
                        role="tab" aria-selected="${active ? 'true' : 'false'}">
                        <span>${label}</span>${count === null ? '' : `<span class="tm-doc-group-manager__tab-count">${count}</span>`}
                    </button>
                `;
            };
            const detailPaneHtml = activeDetailTab === 'excluded'
                ? renderExcludedPane()
                : (activeDetailTab === 'optimization' ? renderOptimizationPane() : renderSourcePane());
"""
jrep(old_tabfn, '', 'renderDetailTab removed')

# ---- 10. 组装：tabs + 单 pane -> 三节（来源 + 隐藏 fold + 优化 fold）----
jrep("""                            <div class="tm-doc-group-manager__tabs" role="tablist" aria-label="分组详情">
                                ${renderDetailTab('sources', '文档来源', currentDocs.length)}
                                ${renderDetailTab('excluded', '隐藏文档页签', currentGroupExcludedDocIds.length)}
                                ${isAllDocs ? '' : renderDetailTab('optimization', '搜索优化')}
                            </div>
                            <div class="tm-doc-group-manager__pane" role="tabpanel">
                                ${detailPaneHtml}
                            </div>
""",
"""                            <div class="tm-doc-group-manager__pane">
                                ${renderSourcePane()}
                                <details class="tm-doc-group-manager__fold">
                                    <summary>已隐藏的文档页签 <span class="tm-doc-group-manager__fold-count">${currentGroupExcludedDocIds.length}</span></summary>
                                    ${renderExcludedPane()}
                                </details>
                                ${isAllDocs ? '' : `
                                <details class="tm-doc-group-manager__fold">
                                    <summary>搜索优化 ${currentGroupCalendarOptimization.enabled ? `<span class="tm-doc-group-manager__fold-count">已启用 · 最近 ${Number(currentGroupCalendarOptimization.days) || 30} 天</span>` : ''}</summary>
                                    ${renderOptimizationPane()}
                                </details>
                                `}
                            </div>
""",
    'assemble sections')

assert 'tm-doc-group-manager__tab' not in js, 'JS 页签残留'
assert 'source-id' not in js, 'JS source-id 残留'
assert 'picker-trigger-row' not in js, 'JS trigger-row 残留'
save(JP, js)
print('JS saved')

# ============================ CSS ============================
CP = ROOT + r'\task-horizon.css'
css = load(CP)

def crep(old, new, tag):
    global css
    n = css.count(old)
    assert n == 1, f'CSS {tag}: 命中 {n} 次'
    css = css.replace(old, new)
    print('ok css:', tag)

# ---- C1. source-id -> source-path ----
crep(""".tm-doc-group-manager__source-id {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--tm-secondary-text);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}""",
""".tm-doc-group-manager__source-path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--tm-secondary-text);
}""",
    'source-path')

# ---- C2. 操作按钮 hover 浮现（桌面）----
crep(""".tm-doc-group-manager__source-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
}""",
""".tm-doc-group-manager__source-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    opacity: 0;
    transition: opacity .12s ease;
}

.tm-doc-group-manager__source-row:hover .tm-doc-group-manager__source-actions,
.tm-doc-group-manager__source-row:focus-within .tm-doc-group-manager__source-actions {
    opacity: 1;
}""",
    'actions hover reveal')

# ---- C3. 移除按钮幽灵化 ----
crep(""".tm-doc-group-manager__text-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-color: color-mix(in srgb, var(--tm-danger-color) 32%, var(--tm-border-color));
    background: color-mix(in srgb, var(--tm-danger-color) 7%, var(--tm-bg-color));
    color: var(--tm-danger-color);
    font-weight: 600;
}""",
""".tm-doc-group-manager__text-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-color: transparent;
    background: transparent;
    color: var(--tm-secondary-text);
    font-weight: 400;
}""",
    'text-action ghost')

# ---- C4. detail-head 允许换行 ----
crep(""".tm-doc-group-manager__detail-head {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 6px 16px 5px;
}""",
""".tm-doc-group-manager__detail-head {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    row-gap: 8px;
    gap: 14px;
    padding: 6px 16px 5px;
}""",
    'detail-head wrap')

# ---- C5. 删 tabs 样式块 ----
old_tabs_css = """
.tm-doc-group-manager__tabs {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    padding: 0 14px;
    border-bottom: 1px solid var(--tm-border-color);
    overflow-x: auto;
    scrollbar-width: none;
}

.tm-doc-group-manager__tabs::-webkit-scrollbar {
    display: none;
}

.tm-doc-group-manager__tab {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 10px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--tm-secondary-text);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
}

.tm-doc-group-manager__tab:hover,
.tm-doc-group-manager__tab:focus-visible {
    color: var(--tm-text-color);
    outline: none;
}

.tm-doc-group-manager__tab.is-active {
    border-bottom-color: var(--tm-primary-color);
    color: var(--tm-primary-color);
}

.tm-doc-group-manager__tab-count {
    min-width: 18px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--tm-hover-bg);
    color: inherit;
    font-size: 10px;
    line-height: 1.4;
    text-align: center;
}
"""
crep(old_tabs_css, '\n', 'tabs css removed')

# ---- C6. 新增 pane-label / fold 样式（插在 .tm-doc-group-manager__pane 前）----
crep(""".tm-doc-group-manager__pane {
    min-width: 0;
    padding: 14px 16px 16px;
}""",
""".tm-doc-group-manager__pane-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--tm-text-color);
}

.tm-doc-group-manager__pane-label small {
    color: var(--tm-secondary-text);
    font-size: 11px;
    font-weight: 400;
}

.tm-doc-group-manager__fold {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--tm-border-color);
}

.tm-doc-group-manager__fold > summary {
    display: flex;
    align-items: center;
    gap: 6px;
    list-style: none;
    font-size: 12px;
    font-weight: 600;
    color: var(--tm-text-color);
    cursor: pointer;
}

.tm-doc-group-manager__fold > summary::-webkit-details-marker {
    display: none;
}

.tm-doc-group-manager__fold > summary::before {
    content: '\\203A';
    color: var(--tm-secondary-text);
    transition: transform .12s ease;
}

.tm-doc-group-manager__fold[open] > summary::before {
    transform: rotate(90deg);
}

.tm-doc-group-manager__fold-count {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--tm-hover-bg);
    color: var(--tm-secondary-text);
    font-size: 10.5px;
    font-weight: 400;
}

.tm-doc-group-manager__fold > .tm-doc-group-manager__pane-intro,
.tm-doc-group-manager__fold > .tm-doc-group-manager__source-list,
.tm-doc-group-manager__fold > .tm-doc-group-manager__empty,
.tm-doc-group-manager__fold > .tm-setting-switch-row,
.tm-doc-group-manager__fold > .tm-doc-group-manager__optimization-days {
    margin-top: 8px;
}

.tm-doc-group-manager__pane {
    min-width: 0;
    padding: 14px 16px 16px;
}""",
    'fold css added')

# ---- C7. more-menu disabled ----
crep(""".tm-doc-group-manager__more-menu button.is-danger {
    color: var(--tm-danger-color);
}""",
""".tm-doc-group-manager__more-menu button.is-danger {
    color: var(--tm-danger-color);
}

.tm-doc-group-manager__more-menu button:disabled {
    opacity: .42;
    cursor: not-allowed;
}

.tm-doc-group-manager__more-menu button:disabled:hover {
    background: transparent;
}""",
    'menu disabled')

# ---- C8. 窄屏：删 tabs 覆盖 ----
crep("""    .tm-doc-group-manager__tabs {
        gap: 0;
        padding: 0 6px;
    }

    .tm-doc-group-manager__tab {
        min-height: 44px;
        flex: 1 0 auto;
        padding: 0 8px;
        font-size: 12px;
    }

""", '', 'narrow tabs removed')

# ---- C9. 窄屏：actions 常显（restore 已包进 actions）----
crep("""    .tm-doc-group-manager__source-actions,
    .tm-doc-group-manager__source-row > .tm-doc-group-manager__restore {
        grid-column: 2;
        justify-content: flex-start;
    }""",
"""    .tm-doc-group-manager__source-actions {
        grid-column: 2;
        justify-content: flex-start;
        opacity: 1;
    }""",
    'narrow actions visible')

assert 'tm-doc-group-manager__tab' not in css, 'CSS 页签残留'
assert 'source-id' not in css, 'CSS source-id 残留'
save(CP, css)
print('CSS saved')
print('ALL DONE')
